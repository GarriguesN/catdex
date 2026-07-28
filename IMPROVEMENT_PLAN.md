# CatDex — Plan de mejora

Generado a partir de un escaneo completo del código fuente (`app/`, `components/`, `lib/`, `scripts/`, `tests/`, config, historial de git) a fecha 2026-07-28. Documento pensado para que un agente lo ejecute fase a fase sin contexto adicional de la conversación original.

Stack: Next.js 16 (App Router, todo `"use client"`, sin `app/api/*`) + React 19 + PocketBase como backend/BaaS, consumido directamente desde el navegador. No hay servidor propio: `pocketbase` es la única fuente de datos real en producción.

Reglas para quien ejecute este plan:
- Cada fase es lo más independiente posible; sigue el orden salvo que se indique lo contrario (Fase 0 es bloqueante y va antes que cualquier otra).
- No añadas abstracciones ni features no pedidas al tocar un archivo — cambios quirúrgicos.
- Tras cada fase: `npm run lint` y `npm run build` deben pasar antes de continuar.
- Si una tarea requiere acceso a la instancia real de PocketBase (rotar contraseña, cambiar reglas de collection) y no hay credenciales/acceso disponibles en el entorno de ejecución, márcala como bloqueada y pásala al usuario explícitamente — no la simules ni la des por hecha.

---

## Fase 0 — Seguridad (bloqueante, antes que nada)

### 0.1 Rotar credenciales de superusuario de PocketBase
`scripts/setup-pocketbase.sh:8` (versión original, antes de esta limpieza) tenía hardcodeado en texto plano el email y la contraseña del superusuario de PocketBase, commiteado en `1557f7e 🗄️ Fase 0: PocketBase desplegado en CT 120`. Esa contraseña hay que darla por comprometida — no se reproduce aquí para no duplicar la exposición en un nuevo commit.

- [ ] Cambiar la contraseña del superusuario afectado directamente en la instancia de PocketBase (admin UI o API), **fuera del repo**.
- [ ] Reescribir `scripts/setup-pocketbase.sh` para que lea credenciales de variables de entorno (`PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`) en vez de tenerlas hardcodeadas:
  ```bash
  TOKEN=$(curl -s -X POST "$BASE/api/collections/_superusers/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
  ```
- [ ] Purgar el secreto del historial de git (`git filter-repo` o BFG Repo-Cleaner) o, como mínimo, documentar en el propio repo que la contraseña antigua fue rotada y ya no es válida. Si se reescribe el historial, coordinar con el usuario antes de forzar el push (acción destructiva sobre remoto compartido).

### 0.2 Cerrar las reglas de PocketBase
`scripts/setup-pocketbase.sh` crea las collections `cats`, `photos`, `achievements` con `listRule/viewRule/createRule/updateRule/deleteRule: ""` (string vacío = acceso público sin autenticación). Hay que definir reglas reales, tanto en el script (para que futuros `setup` las apliquen) como directamente en la instancia viva.

Reglas objetivo (ajustar nombres de campo a los reales del schema PocketBase):
- `cats`:
  - `listRule` / `viewRule`: `@request.auth.id != ""` (requiere estar logueado; lectura para todos los usuarios autenticados, ya que es un mapa colaborativo).
  - `createRule`: `@request.auth.id != ""`.
  - `updateRule`: `@request.auth.id != "" && (discoveredBy = @request.auth.id || @request.auth.id != "")` — decidir con el usuario si solo el descubridor puede editar/borrar, o cualquier colaborador (dado que es "colonia" compartida). Como mínimo, exigir auth.
  - `deleteRule`: restringir a `discoveredBy = @request.auth.id` — que nadie pueda borrar el gato de otro.
- `photos`: mismo patrón, `deleteRule`/`updateRule` limitados a `user = @request.auth.id`.
- `achievements`: `createRule`/`updateRule` deben ser server-side only (`""` de PocketBase con reglas restrictivas, p. ej. `@request.auth.id = ""` para bloquear escritura de cliente, y usar un PocketBase hook/JS que sea quien escriba).
- `users.score`: el campo `score` **no debe ser editable por el propio usuario vía API pública**. Mover el award de puntos a un PocketBase hook (`pb_hooks/*.pb.js`) que se dispare `onRecordAfterCreateSuccess` en `photos`, calculando y aplicando el incremento server-side. Quitar de `app/capture/page.tsx:194-202` la escritura directa de `score` desde el cliente.

- [ ] Actualizar `scripts/setup-pocketbase.sh` con las reglas anteriores.
- [ ] Aplicar las mismas reglas a la instancia de producción.
- [ ] Escribir el hook de PocketBase que otorga puntos server-side (sustituye a `app/capture/page.tsx:194-202`).
- [ ] Quitar de `app/capture/page.tsx` el bloque que actualiza `score` desde el cliente.

### 0.3 Arreglar "Borrar toda la colección"
`app/settings/page.tsx:26-37` (`deleteAll`) hace `getFullList()` sin filtro sobre `cats` y borra todo — en una base compartida esto borra los gatos de todos los usuarios, no solo los propios.

- [ ] Decidir con el usuario: ¿debe existir un "borrar todo" en una app colaborativa? Si sí, filtrar por `discoveredBy = pb.authStore.record.id` en la query antes de borrar. Si no, quitar el botón/función de `app/settings/page.tsx` por completo.
- [ ] Sea cual sea la decisión, este cambio depende de 0.2 (con reglas cerradas, el `deleteRule` del backend ya impediría el borrado ajeno aunque el cliente lo intente — pero corregir también el cliente para no dar una opción engañosa en la UI).

### 0.4 Ownership check en ficha de gato
`app/cat/page.tsx` permite renombrar/editar notas/borrar sin comprobar si el usuario actual es el descubridor. Tras 0.2, el backend ya bloqueará operaciones no autorizadas, pero:
- [ ] Ocultar en la UI los botones de editar nombre / borrar cuando `cat.discoveredBy !== pb.authStore.record?.id`, para no mostrar acciones que van a fallar silenciosamente contra las nuevas reglas.

**Criterio de fin de Fase 0**: reglas de PocketBase verificadas manualmente (probar con un usuario B que no puede borrar/editar datos del usuario A), contraseña rotada, secreto fuera del repo, `npm run build` sigue pasando.

---

## Fase 1 — Limpieza de código muerto (bajo riesgo, rápida)

Verificado que ninguno de estos símbolos tiene referencias fuera de sí mismos (`grep` completo sobre `app/`, `components/`, `lib/`).

### 1.1 Componentes huérfanos a eliminar
Apuntan a una API REST (`/api/cats`, `/api/photos/:id`) que no existe en el repo — resto de la versión pre-PocketBase (SQLite/NextAuth):
- [ ] `components/CatPicker.tsx`
- [ ] `components/MatchConfirm.tsx`
- [ ] `components/CatAvatar.tsx`
- [ ] `components/ConfirmModal.tsx`
- [ ] `components/BadgeUnlock.tsx`
- [ ] `components/ServiceWorkerRegister.tsx` (ver 1.3 antes de borrar — puede que se necesite en vez de borrarse)

### 1.2 Librería/DB muertas
- [ ] Eliminar `lib/db.ts` (esquema SQLite completo: users/cats/photos/achievements/sessions/accounts/verification_tokens — sin referencias).
- [ ] Eliminar `lib/capture.ts` (`computeHashFromCanvas`, `HIGH_SUGGESTION`, `LOW_SUGGESTION` — no usados, lógica duplicada inline en `app/capture/page.tsx`).

### 1.3 Dependencias no usadas en `package.json`
Confirmar con `grep -r` antes de quitar cada una (por si Fase 2 decide reutilizar algo):
- [ ] `next-auth` — cero referencias en el código actual.
- [ ] `better-sqlite3` + `@types/better-sqlite3` — solo usados por `lib/db.ts` (que se borra en 1.2).
- [ ] `zustand` — cero referencias.

### 1.4 Decidir y resolver el PWA a medias
Hoy conviven dos enfoques incompletos:
- `public/sw.js` (service worker manual, cache-first) + `components/ServiceWorkerRegister.tsx` que **nunca se monta** en `app/layout.tsx` → el SW nunca se registra hoy, pese a que `public/manifest.json` promete "100% offline".
- `@serwist/next` instalado en `devDependencies` pero no usado en `next.config.ts`.

Elegir una opción (recomendado: opción A, menor esfuerzo dado que `sw.js` ya está escrito y probado):
- **Opción A**: Montar `<ServiceWorkerRegister />` en `app/layout.tsx` (dentro de `<AuthProvider>`, junto a `<BottomNav />`) y eliminar la dependencia `@serwist/next` del `package.json`.
- **Opción B**: Migrar a Serwist (`withSerwist` en `next.config.ts`, generar el SW desde `app/sw.ts`), eliminar `public/sw.js` manual y `components/ServiceWorkerRegister.tsx`.

- [ ] Implementar la opción elegida.
- [ ] Verificar en build de producción (`npm run build && npm run start`) que el SW se registra (DevTools → Application → Service Workers) y que `/` sigue siendo accesible offline tras la primera carga.

**Criterio de fin de Fase 1**: `npm run lint` sin warnings nuevos, `npm run build` limpio, ningún import roto, PWA funcionando de una sola forma coherente.

---

## Fase 2 — Corrección de producto

### 2.1 Alinear el flujo de captura con el spike de pHash
`tests/phash-spike-results.md` concluye que pHash tiene TPR 40% / FPR 36% (peor que azar) para re-identificación, y fija la decisión de producto: **"manual-first: el usuario siempre elige el gato existente o crea uno nuevo"**. El código actual en `app/capture/page.tsx:121-154` no sigue esa decisión: filtra candidatos a `similarity > 60` y, si no hay ninguno, crea un gato nuevo automáticamente sin dar nunca la opción de buscar en toda la colección.

- [ ] En `app/capture/page.tsx`, tras el cálculo de `hash` (línea ~125), quitar el filtro `filter(c => c.similarity > 60)` como criterio de "hay match o no". En su lugar:
  - Mostrar siempre una pantalla de selección manual (reutilizar/adaptar `components/CatPicker.tsx` restaurado desde 1.1 si aún no se ha borrado, o reescribirlo contra PocketBase en vez de `/api/cats`) con la lista completa de gatos (paginada, ver Fase 3), pre-ordenada por similarity de pHash como *sugerencia de orden*, no como filtro de inclusión/exclusión.
  - El usuario elige explícitamente "es este gato" o "es uno nuevo" — nunca se debe auto-crear un gato nuevo sin que el usuario lo confirme cuando ya existen gatos en la colección.
- [ ] Actualizar `components/CatPicker.tsx` para consumir `getPocketBase().collection("cats")` en vez del inexistente `/api/cats`, y usarlo desde `app/capture/page.tsx` en sustitución de la pantalla `matching` actual.
- [ ] Actualizar `tests/phash-spike-results.md` o añadir una nota si la decisión de producto cambia conscientemente (para que quede documentado por qué se diverge del spike, si el usuario decide mantener el auto-filtro tras revisar esto).

### 2.2 Logros: implementar de verdad o quitar la sección
`app/stats/page.tsx:85-95` pinta los 18 badges de `lib/achievements-defs.ts` siempre bloqueados; no existe en todo el repo código que lea/escriba la collection `achievements` ni que evalúe si un usuario cumple los requisitos de un logro.

Opción recomendada (implementar mínimo viable), a validar con el usuario antes de empezar:
- [ ] Crear un hook de PocketBase (`onRecordAfterCreateSuccess` en `photos` y `cats`) que evalúe las condiciones de cada logro en `lib/achievements-defs.ts` (first_catch, collector_10, photographer_50, etc.) contra los datos del usuario y, si se cumple, inserte un registro en `achievements`.
- [ ] En el cliente, `app/stats/page.tsx` debe consultar `pb.collection("achievements").getFullList({ filter: 'user = "..."' })` y pintar como desbloqueados (color, sin grayscale) los que el usuario ya tiene, con fecha de desbloqueo.
- [ ] Conectar el componente `BadgeUnlock.tsx` (restaurado de 1.1) al flujo de captura: tras guardar una foto, si el hook devuelve nuevos logros desbloqueados, mostrar el modal de celebración.

Si el usuario prefiere no invertir en esto ahora: quitar la sección "Badges" de `app/stats/page.tsx` en vez de mostrar una funcionalidad falsa, y reevaluar más adelante.

**Criterio de fin de Fase 2**: el flujo de captura nunca crea un gato duplicado sin confirmación explícita del usuario cuando ya hay candidatos posibles; la sección de logros o funciona de verdad o no se muestra.

---

## Fase 3 — Escalabilidad y fiabilidad

### 3.1 Paginación
Sin límite hoy (`getFullList()` o `getList()` con `perPage` alto sin scroll infinito):
- [ ] `app/page.tsx:62-95` (`loadCats`) — 3 llamadas por carga de home (cats x2 + photos), una de ellas redundante. Combinar la carga de gatos y derivar el feed de actividad de la misma respuesta en vez de pedirla dos veces.
- [ ] `app/capture/page.tsx:129` — escanea **todos** los gatos de la colección en cada foto capturada (`getFullList` sin filtro) solo para calcular similarity de pHash. Si la colección crece, esto se vuelve lento y caro. Mover el matching por pHash a una PocketBase custom route server-side que reciba el hash y devuelva únicamente los N candidatos más cercanos (evita transferir toda la tabla al cliente en cada captura).
- [ ] `app/stats/page.tsx:22-28` y `app/settings/page.tsx:29` — `getFullList()` sin límite; aceptable a corto plazo pero documentar el límite razonable (p. ej. cap a 500 con aviso) si no se resuelve server-side.

### 3.2 Condiciones de carrera
`app/capture/page.tsx:178-183` (photoCount) y `194-201` (score, ya movido a hook en 0.2) hacen lee-modifica-escribe sin transacción — dos capturas simultáneas del mismo gato pueden perder un incremento.
- [ ] Sustituir el incremento de `photoCount` en el cliente por un hook de PocketBase (`onRecordAfterCreateSuccess` en `photos`) que incremente de forma atómica en el servidor, igual que el de score (aprovechar el mismo hook de 0.2 si aplica).

### 3.3 Validar umbrales hardcodeados
A diferencia de pHash/MobileNet-reid (que sí tuvieron spike tests con datos reales antes de decidir), estos umbrales son estimaciones sin validar pese a bloquear cada captura:
- [ ] `lib/image.ts:102` — blur score `< 50`. El propio comentario del código dice "calibrate with real photos" y nunca se hizo. Crear un spike similar a `tests/phash-spike.test.ts` usando `tests/fixtures/` (fotos nítidas vs borrosas reales) para fijar el umbral con datos.
- [ ] `lib/classifier.ts:145,155` — confianza MobileNet `< 40` (blurry) / `< 70` (low_confidence). Mismo tratamiento: validar contra fotos reales de gatos callejeros (que suelen tener peor confianza que estudio) antes de mantener o ajustar estos números.

### 3.4 Orientación EXIF
`lib/image.ts` (`normalizePhoto`) dibuja la imagen en `<canvas>` sin leer/corregir el flag de orientación EXIF. Las fotos verticales de iPhone (muy probable en un flujo de "foto de gato callejero con el móvil") suelen venir con orientación EXIF que los navegadores no aplican al pintar en canvas.
- [ ] Añadir lectura del flag EXIF orientation (librería ligera tipo `exifr`, o parseo manual del segmento EXIF) y rotar/flipear el canvas según corresponda antes de exportar `blob`/`thumbBlob`.

**Criterio de fin de Fase 3**: capturas concurrentes no pierden incrementos; el escaneo de gatos en captura no se degrada con el crecimiento de la colección; umbrales de blur/confianza respaldados por datos, no por estimación.

---

## Fase 4 — Calidad y CI

### 4.1 Test runner real
Hoy `tests/` solo tiene scripts de investigación puntual (`npx tsx tests/*.test.ts`), no hay `test` script en `package.json` ni jest/vitest configurado.
- [ ] Añadir `vitest` como dev dependency y script `"test": "vitest run"` en `package.json`.
- [ ] Tests unitarios mínimos:
  - `lib/phash.ts`: `hammingDistance`, `similarity` con casos conocidos (hash igual a sí mismo = 100%, hashes complementarios = 0%).
  - `lib/image.ts`: `blurScore` sobre los fixtures reales de `tests/fixtures/` (una vez fijado el umbral en 3.3, congelarlo con un test de regresión).
  - `lib/copy.ts`: `getBlurCopy`/`getNotCatCopy` nunca repiten el mismo índice dos veces seguidas.
  - `lib/utils.ts`: `formatTimeAgo`, `roundCoord` (casos límite: 0, negativos, fracciones).

### 4.2 CI
- [ ] Añadir `.github/workflows/ci.yml` (o equivalente si no usan GitHub) que en cada PR ejecute: `npm ci`, `npm run lint`, `npm run build`, `npm test`.

### 4.3 Auth centralizada
El guard `if (!user) router.replace("/login")` está duplicado por página (`app/page.tsx:47-49` y patrones similares) en vez de centralizado, causando un flash de contenido no autenticado antes del redirect.
- [ ] Centralizar el chequeo de sesión en `app/layout.tsx` o un wrapper compartido, mostrando un loading state único mientras `authLoading` es true, en vez de que cada página lo repita.

### 4.4 Manejo de errores visible
Varios `catch {}` vacíos tragan errores en silencio (`app/map/page.tsx:66`, `app/stats/page.tsx:30`).
- [ ] Como mínimo, `console.error` con contexto en cada catch vacío. Si se quiere ir más lejos, un toast de error visible al usuario (ya usan `sonner`, que está en dependencies pero conviene confirmar su uso real) en los flujos críticos (login, captura, borrado).

**Criterio de fin de Fase 4**: `npm test` pasa en CI, PRs bloqueados si lint/build/test fallan, no hay fallos silenciosos en las rutas críticas.

---

## Resumen de dependencias entre fases

- Fase 0 no depende de nada — es la única estrictamente bloqueante y debe ir primero.
- Fase 1 es independiente de 0 salvo por 1.1/1.4 (restaurar `CatPicker`/`ServiceWorkerRegister`), que conviene coordinar con Fase 2.1 y 1.4 respectivamente para no hacer el trabajo dos veces.
- Fase 2.1 depende de 1.1 (necesita `CatPicker.tsx` disponible).
- Fase 3.2 depende de 0.2 (el hook de puntos ya debe existir; se extiende para `photoCount`).
- Fase 4 puede ejecutarse en paralelo a 2 y 3 en cuanto Fase 1 esté cerrada (necesita un árbol de código limpio para que los tests tengan sentido).

## Fuera de alcance (no tocar sin pedirlo explícitamente)
- Rediseño visual / UX de las pantallas de captura (`components/capture/*`) — están terminadas y funcionan, no forman parte de este plan.
- Cambio del algoritmo de re-identificación a uno más sofisticado (Wildbook/HotSpotter/Siamese) — el propio `tests/mobilenet-spike-results.md` ya concluye que no hay opción viable en navegador; server-side quedaría fuera del alcance de este plan salvo que el usuario lo pida.
- Migración de PocketBase a otro backend.
