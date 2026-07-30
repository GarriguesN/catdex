# CatDex — Review completa y plan de mejoras (2026-07-30)

Generado auditando el código actual (`app/`, `components/`, `lib/`, `pb_hooks/`, `scripts/`) contra `IMPROVEMENT_PLAN.md` (2026-07-28) y `FRIENDS_PLAN.md` (2026-07-29), para saber qué de esos dos planes está realmente hecho, qué queda abierto, y qué problemas nuevos han aparecido desde entonces. Pensado para que un agente lo ejecute fase a fase sin contexto adicional de la conversación original.

## Estado de los dos planes anteriores

**`IMPROVEMENT_PLAN.md` — Fase 0 (seguridad) y Fase 1 (código muerto): hechas.**
- Credenciales de PocketBase ya no están hardcodeadas (`scripts/setup-pocketbase.sh` exige `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD`).
- Reglas de `cats`/`photos`/`achievements` ya no son públicas; `achievements` solo se escribe desde hooks (`createRule`/`updateRule: null`).
- `score`/`photoCount` ya no se escriben desde el cliente — movidos a `pb_hooks/scoring.pb.js`.
- El flujo de captura ya no auto-crea gatos sin confirmación — `CatPicker` se muestra siempre.
- Componentes/libs muertos (`CatPicker`... espera, ese se restauró y ahora se usa; `MatchConfirm`, `CatAvatar`, `ConfirmModal`, `BadgeUnlock`, `lib/db.ts`, `lib/capture.ts`) y dependencias muertas (`next-auth`, `better-sqlite3`, `zustand`) confirmados ausentes.

**`IMPROVEMENT_PLAN.md` — Fase 2/3 (corrección de producto/escalabilidad): parcialmente hechas.** EXIF orientation implementado (con una duda de correctness, ver más abajo); reverse geocoding en captura implementado. Pendiente: paginación/matching pHash server-side, spike de calibración de umbrales de blur/confianza.

**`IMPROVEMENT_PLAN.md` — Fase 4 (CI/tests): NO hecha.** Sigue sin `vitest`/`jest`, sin `test` script, sin `.github/workflows`.

**`FRIENDS_PLAN.md` — prácticamente completo.** `/profile` reproduce el mockup (header+campana, resumen de 5 stats, logros recientes, timeline, amigos), `/profile/stats` y `/profile/achievements` existen como "Ver todos", sistema de amigos (`lib/friends.ts`, `app/friends/page.tsx`, hooks de invitación/amistad) funcional, mapa con toggle de amigos y color diferenciado. Quedan sin implementar (a propósito, fuera de alcance salvo pedido explícito) 7 de los 18 logros: `lucky_day`, `loyal_5`, `loyal_50`, `rainy_day`, `streak_7`, `streak_30`, `share_first`.

## Bugs corregidos en esta sesión

| # | Prioridad | Archivo | Qué estaba mal | Fix aplicado |
|---|---|---|---|---|
| 1 | Alta | `app/settings/account/page.tsx` (`deleteAll`) | Borraba `cats` sin borrar antes sus `photos`; como `photos.cat` es relación `required` sin `cascadeDelete`, PocketBase debía rechazar el borrado de cualquier gato con fotos — "Borrar toda la colección" fallaba casi siempre. | Ahora borra las `photos` de cada gato antes de borrar el gato, igual que `app/cat/page.tsx`'s `deleteCat()`. |
| 2 | Media | `app/cat/page.tsx` (ficha "Detalles técnicos") | `"¿Es un gato?": "Sí"` y `"Modelo IA": "MobileNetV3"` estaban hardcodeados — ningún campo de `photos`/`cats` guarda el resultado real del clasificador ni el modelo usado (además el modelo real es coco-ssd desde `c3ad21c`, no MobileNet). Todo gato mostraba 100% de confianza aunque no fuera cierto. | Se quitan ambas filas — dato falso es peor que no mostrar el dato. Persistir el resultado real requeriría un campo nuevo en `photos` + tocar el flujo de captura; no se ha hecho por ser fuera de alcance de un fix quirúrgico (ver Roadmap). |
| 3 | Media | `pb_hooks/scoring.pb.js` | Incremento de `photoCount`/`score` con `$app.findRecordById` + `$app.save` sin transacción — dos capturas concurrentes al mismo gato podían perder un incremento. | Envuelto en `$app.runInTransaction((txApp) => ...)`, usando `txApp` (no `$app`) para todos los find/save dentro, tanto en create como en delete. También se corrigió que el `return` temprano por falta de `cat`/`user` no llamaba a `e.next()`, lo que habría cortado la cadena de hooks (el de logros nunca se ejecutaría). |
| 4 | Media | `pb_hooks/achievements-utils.js` (`syncAchievements`) | Mismo patrón no transaccional: lecturas y escrituras de `achievements` sin agrupar. | Envuelto en `$app.runInTransaction`, mismo patrón que el fix anterior. |

## Micro-fixes de bajo riesgo aplicados de paso

- `next.config.ts`: quitado `serverExternalPackages: ["better-sqlite3"]` — la dependencia ya no existe en `package.json`.
- `components/profile/EditProfileSheet.tsx`: se llama `URL.revokeObjectURL()` sobre el preview del avatar al elegir uno nuevo y al cerrar el sheet (evita una fuga de object URL por cada foto probada).
- `hooks/useRefetchOnFocus.ts`: se añade un debounce de 300ms — Safari/Chrome móvil disparan `focus` y `visibilitychange` seguidos en el mismo cambio de pestaña, causando doble fetch.
- `app/capture/page.tsx`: dos comentarios actualizados (seguían diciendo "MobileNet" tras el cambio a coco-ssd en `c3ad21c`).

Verificado tras los cambios: `npm run build` compila limpio; `npm run lint` no introduce errores nuevos (los ~570 errores/9000 warnings existentes son deuda previa — patrones `react-hooks/set-state-in-effect`, `no-explicit-any`, funciones usadas antes de declararse — no tocados en esta sesión; ver hallazgo de lint más abajo).

## Bugs/gaps identificados pero NO corregidos aún (a decidir)

### Prioridad baja / requieren más alcance
- **Posible doble-premio de puntos** (`pb_hooks/scoring.pb.js`): `isFirstPhoto` se deriva de `cat.photoCount === 0`. Si algún día se permite borrar una foto suelta de un gato con varias fotos (hoy no existe esa opción en la UI — solo se borra el gato entero con todas sus fotos a la vez), la siguiente foto de ese gato volvería a cobrar como "primera" sin que se hubiera restado el score anterior. Arreglarlo bien requiere un campo nuevo (`firstPhotoAwarded` en `cats`) + backfill para gatos existentes — no se ha hecho por ser una migración de schema, no un fix quirúrgico, y el bug hoy es inalcanzable desde la UI.
- **`achievements-utils.js` sin paginación**: recalcula el historial completo de gatos/fotos del usuario en cada captura (`findRecordsByFilter(..., 0, 0, ...)`). Aceptable a escala actual; coste O(n) por subida que crecerá con la colección.
- **`lib/image.ts:24-26`** — la corrección de orientación EXIF puede ser redundante o incorrecta si el navegador ya auto-corrige la orientación al decodificar `<img>`. No verificado con una foto real rotada de iPhone.
- **Dos `alert()` nativos** rompen la consistencia del resto de la UI (`app/capture/page.tsx`, `app/settings/account/page.tsx`) — el resto de la app usa error inline o `Sheet`.

### Inconsistencias de arquitectura
- **Guard de auth incompleto**: `useRequireAuth` protege `/`, `/profile`, `/friends`, `/settings/account`, pero no `/cat`, `/map`, `/capture` — esas tres rutas no redirigen a `/login` si se accede deslogueado (degradan a estados vacíos "por casualidad", no por diseño).
- **`users.listRule` sin verificar**: ni `setup-pocketbase.sh` ni `migrate-friends.sh` tocan las reglas de `users` más allá de añadir `inviteCode`. El ranking de `/profile/stats` y el `expand` de amistades dependen de poder listar otros usuarios — probablemente ya está abierto en producción (la feature de ranking es anterior a amigos) pero no verificable desde el repo.
- **Errores silenciosos parciales**: los `catch` ya hacen `console.error`, pero ninguno muestra retry/error visible al usuario — una carga fallida simplemente deja la sección vacía.
- **Sin UI optimista** en aceptar/rechazar/eliminar amigos — cada acción espera el round-trip completo.
- **Housekeeping de lint**: `npm run lint` reporta ~9800 problemas porque el `globalIgnores` de `eslint.config.mjs` (`.next/**`) no cubre rutas anidadas — está lintando el `.next/` compilado dentro de `.claude/worktrees/*/`. Añadir `.claude/worktrees/**` a los ignores limpiaría casi todo el ruido y dejaría visible la deuda real (~570 errores en código fuente propio).
- **Worktrees obsoletos**: `.claude/worktrees/catdex-ui-ux-system-166760` y `.claude/worktrees/code-scan-improvement-plan-643354` corresponden a ramas ya mergeadas en `main` (`536b54a`, `828f576`) — candidatos a `git worktree remove`, a confirmar porque uno de los dos podría estar en uso activo.
- **`tsconfig.tsbuildinfo`** no está en `.gitignore`.

## Roadmap de features nuevas (a validar antes de arrancar)

**Quick win**
- Badge de nº de solicitudes pendientes en el icono "Perfil" del `BottomNav` (ya identificado como opcional en `FRIENDS_PLAN.md`, dato ya disponible vía `listPendingIncoming()`).

**Medio esfuerzo**
- Vitest + CI básico (lint + build + test en cada PR) — cierra la Fase 4 de `IMPROVEMENT_PLAN.md` y habría detectado el bug #1 de esta review antes de llegar a producción.
- Extender `useRequireAuth` a `/cat`, `/map`, `/capture` (o centralizarlo en `AppShell`).
- Ruta server-side de PocketBase para matching de pHash (evita escanear todos los gatos del usuario en cada captura).
- Estados de error/retry visibles en cargas críticas (amigos, mapa, perfil).
- Persistir el resultado real del clasificador (`isCat`, `confidence`, modelo) en `photos` si se quiere que la ficha técnica del gato vuelva a mostrar esos datos — con datos reales esta vez.

**Features de producto (necesitan decisión de alcance)**
- Los 7 logros restantes sin lógica (rachas, clima, comparticiones).
- Compartir ficha de gato fuera de la app (Web Share API) — Fase 4 opcional de `FRIENDS_PLAN.md`, nunca implementada.
- Notificaciones push reales para solicitudes de amistad.

## Fuera de alcance (no tocar sin pedirlo explícitamente)
- Migración de PocketBase a otro backend.
- Rediseño visual/UX de pantallas ya terminadas (cualquier cambio de diseño en curso, p. ej. el scroll de la ficha de gato, se coordina aparte).
- Cambio del algoritmo de re-identificación (ya descartado por los spikes de pHash/MobileNet).
