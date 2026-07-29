# CatDex — Plan: Perfil, Logros reales y Sistema de amigos

Generado a partir de un escaneo completo del código (`app/`, `components/`, `lib/`, `scripts/`, `pb_hooks/`) a fecha 2026-07-29. Pensado para que un agente lo ejecute fase a fase sin contexto adicional de la conversación original.

Stack: Next.js 16 (App Router, todo `"use client"`, **sin `app/api/*`**) + React 19 + PocketBase como backend/BaaS. Toda la lógica de servidor vive en `pb_hooks/*.pb.js`, no en rutas de Next. Antes de tocar código, leer `node_modules/next/dist/docs/` para las convenciones de esta versión (aviso de `AGENTS.md`).

## Decisiones de producto ya cerradas con el usuario

1. **Amistad = solicitud + aceptación** (no conexión instantánea). Necesita estado `pending`/`accepted` y una pantalla de solicitudes.
2. **Mapa por defecto = solo tus propias capturas.** Hoy `app/map/page.tsx` carga fotos de *todos* los usuarios sin filtrar — esto cambia. El toggle "Mostrar capturas de amigos" añade las de tus amigos en otro color, encima de las tuyas.
3. **Logros con persistencia real**: además de cambiar el emoji por icono, se escribe en la collection `achievements` (ya existe en el schema pero nadie escribe en ella hoy) vía hook de PocketBase, con fecha real de desbloqueo.
4. **Añadir amigos por código de invitación** (no buscador de usuarios — evita exponer el listado de `users`).

## Hallazgos relevantes del escaneo

- `users` (collection auth de PocketBase) ya tiene `name`, `avatar`, `email`, `score`, pero **hoy nada permite editarlos** — el registro (`app/login/page.tsx:43`) solo pide email/contraseña. Hay que añadir edición de perfil.
- Logros: `app/settings/achievements/page.tsx` calcula 10 de los 18 badges de `lib/achievements-defs.ts` en cliente, al vuelo, sin persistencia. Los otros 8 (`lucky_day`, `loyal_5`, `loyal_50`, `rainy_day`, `streak_7`, `streak_30`, `share_first`) están definidos pero **nunca se evalúan en ningún sitio** — necesitan datos que hoy no se trackean (rachas por gato, clima, comparticiones).
- El mapa (`app/map/page.tsx:39`) hace `filter: lat!=null` sin filtrar por usuario → ya es global. Cambiar esto es un cambio de comportamiento real, no solo cosmético.
- La regla `listRule`/`viewRule` de `photos` y `cats` en `scripts/setup-pocketbase.sh` es `@request.auth.id != ""` — **cualquier usuario autenticado puede leer las fotos de cualquier otro vía API directa**, sea o no su amigo. Restringir el mapa en el cliente no cierra esto por sí solo (ver Fase 3.5).
- Único sitio que enlaza a `/stats`: `components/BottomNav.tsx:22`. Renombrar la ruta a `/profile` es seguro.
- No existe token de color para "amigo" en `app/globals.css` (solo `--color-catdex-orange`, `-green`, `-red`). Hay que añadir uno.
- Componentes reutilizables ya disponibles: `Card`, `Sheet`, `ConfirmDialog`, `Toggle`, `SettingsRow`/`SettingsGroup`, `IconButton`. No hace falta crear primitivas nuevas de UI.

---

## Fase 0 — Backend PocketBase (schema + hooks)

Bloqueante: todo lo demás depende de esto. Requiere acceso a la instancia PocketBase real (admin UI o API) — si no hay credenciales disponibles en el entorno de ejecución, marcar como bloqueado y pasarlo al usuario.

### 0.1 Collection `friendships`
```
requester   relation → users, required
addressee   relation → users, required
status      select("pending","accepted"), required, default "pending"
created     autodate onCreate
updated     autodate onCreate,onUpdate
```
Reglas:
- `listRule` / `viewRule`: `@request.auth.id != "" && (requester = @request.auth.id || addressee = @request.auth.id)`
- `createRule`: `@request.auth.id != "" && requester = @request.auth.id && requester != addressee`
- `updateRule`: `@request.auth.id != "" && addressee = @request.auth.id` (solo el destinatario puede pasar `pending` → `accepted`; el emisor no debe poder auto-aceptarse)
- `deleteRule`: `@request.auth.id != "" && (requester = @request.auth.id || addressee = @request.auth.id)` (cualquiera de las dos partes puede cancelar la solicitud, rechazarla o deshacer la amistad — se modela como borrar la fila, no como `status="declined"`)

Añadir hook `onRecordBeforeCreateRequest` en un nuevo `pb_hooks/friendships.pb.js` que rechace la creación si ya existe una fila con el mismo par de usuarios en cualquier orden y `status` distinto de borrado (evita duplicados/solicitudes cruzadas duplicadas).

- [ ] Crear la collection y las reglas (actualizar también `scripts/setup-pocketbase.sh` para que un `setup` futuro la reproduzca).
- [ ] Escribir `pb_hooks/friendships.pb.js` con la validación anti-duplicados.
- [ ] Desplegar el hook (`/opt/pocketbase/pb_hooks/` según la nota en `pb_hooks/scoring.pb.js:4`).

### 0.2 Código de invitación
- [ ] Añadir campo `inviteCode` (text, `unique`) a la collection `users`.
- [ ] En `pb_hooks/friendships.pb.js` (o un archivo nuevo `pb_hooks/invite-codes.pb.js`), añadir `onRecordAfterCreateSuccess` sobre `users` que genere un código corto único (p. ej. 8 caracteres base32 sin caracteres ambiguos) y lo guarde si no existe — cubre tanto registro por email como por OAuth.
- [ ] Añadir una ruta custom de PocketBase (`routerAdd("POST", "/api/catdex/resolve-invite", ...)`) que reciba `{ code }` y devuelva `{ id, name, avatar }` del usuario dueño del código — **nunca el email**. Esto evita abrir `listRule`/`viewRule` de `users` a todos los autenticados (que expondría email de cualquier usuario a cualquier otro).
- [ ] Devolver 404 controlado si el código no existe, y no filtrar información en el mensaje de error.

### 0.3 Persistencia de logros
Alcance v1 (recomendado, evita meterse en terreno no pedido): persistir exactamente los 10 badges que ya se evalúan hoy en `app/settings/achievements/page.tsx` (`first_catch`, `collector_10`, `collector_25`, `photographer_50`, `photographer_500`, `namer`, `notekeeper`, `night_owl`, `early_bird`, `explorer_3`, `explorer_10`). Los 8 restantes (`lucky_day`, `loyal_5`, `loyal_50`, `rainy_day`, `streak_7`, `streak_30`, `share_first`) necesitan datos/lógica que no existen hoy (rachas por gato individual, clima, tracking de comparticiones) — **fuera de alcance de este plan salvo que se pida explícitamente**; dejarlos visibles pero bloqueados en la UI como ya ocurre.

- [ ] Portar la lógica de condiciones de `app/settings/achievements/page.tsx:37-54` a un hook de PocketBase (`pb_hooks/achievements.pb.js`), disparado en `onRecordAfterCreateSuccess` de `photos` **y** `cats`.
- [ ] El hook recalcula el set de badges cumplidos del usuario dueño del registro, y para cada uno que no exista ya en `achievements` (`user` + `badgeCode`), crea la fila con `unlockedAt = new Date().getTime()`.
- [ ] Confirmar que `achievements.createRule`/`updateRule` siguen en `null` (ya lo están en `scripts/setup-pocketbase.sh:102-103`) — solo el hook (con `$app`, privilegios de servidor) puede escribir.
- [ ] Desplegar el hook.

### 0.4 Campo `city` en `photos` (reverse geocoding)
**Decidido**: se geocodifica en el momento de la captura, no al cargar el perfil — ver justificación completa en 1.3. Cambios de schema:
- [ ] Añadir campo `city` (text, opcional — no `required`, porque el geocoding es best-effort y no debe bloquear el guardado de la foto) a la collection `photos` en `scripts/setup-pocketbase.sh`.
- [ ] En `app/capture/page.tsx`, tras obtener `lat`/`lng` (mismo punto donde ya se preparan esos campos para el registro de `photos`), llamar a un nuevo helper `reverseGeocode(lat, lng)` en `lib/geo.ts` contra la API pública de Nominatim (OpenStreetMap, `https://nominatim.openstreetmap.org/reverse`), respetando su política de uso (1 req/s, `User-Agent` identificando la app — no hay volumen para chocar con el límite dado que se llama una vez por captura, no por segundo).
- [ ] Si la llamada falla (sin red, timeout, rate limit) o no hay `lat`/`lng`, guardar la foto igualmente con `city = ""` — nunca bloquear el flujo de captura por esto, mismo criterio que ya se aplica a otros checks best-effort del flujo.
- [ ] Fotos ya existentes (anteriores a este cambio) se quedan sin `city` — no hay backfill automático en este plan (fuera de alcance salvo que se pida explícitamente). "Ciudades exploradas" solo contará fotos con `city` no vacío; documentarlo como limitación conocida, no ocultarlo silenciosamente.

**Criterio de fin de Fase 0**: capturar una foto de prueba desbloquea un logro nuevo y aparece una fila real en `achievements` con `unlockedAt`; una foto de prueba con GPS guarda un `city` no vacío; un usuario B puede resolver el código de invitación de A y obtener solo `{id,name,avatar}`; un usuario B no puede `PATCH` una `friendship` de la que no es `addressee`.

---

## Fase 1 — Perfil (transformar Stats)

### 1.1 Renombrar la ruta
- [ ] Mover `app/stats/` → `app/profile/`.
- [ ] `components/BottomNav.tsx:22`: `href: "/profile"`, `label: "Perfil"`, icono `User` en vez de `BarChart3` (import de `lucide-react`, ya usado en `app/settings/page.tsx:4`).
- [ ] Grep final sobre `app/`, `components/` por `/stats` para no dejar enlaces rotos (a fecha del escaneo solo existe el de `BottomNav`).

### 1.2 Mockup pixel-perfect (fuente de verdad visual)

El usuario ha aportado un mockup concreto para `/profile` con este prompt de referencia — implementar **tal cual**, sin rediseñar, sin simplificar, sin mover secciones, sin cambiar espaciados/tipografía/jerarquía. Pixel-perfect, mobile-first, proporciones iPhone, estética Apple HIG:

- General: fondo `#F8F4ED`, tarjetas blancas `#FFFFFF` con esquinas redondeadas 20–24px, solo sombras suaves, sin gradientes/glassmorphism/neumorphism, sin bordes innecesarios, mucho whitespace, padding horizontal de página 24px, gran separación entre secciones.
- Paleta: primario `#FF8A26`, primario claro `#FFA54A`, texto `#222326`, texto secundario `#686868`, bordes `rgba(0,0,0,0.05)` — todo ya cubierto por los tokens existentes de `app/globals.css` salvo el color de borde suave (revisar si ya existe `--color-catdex-hairline` equivalente antes de añadir uno nuevo).
- **Header**: título "Perfil" arriba a la izquierda; icono de campana de notificaciones arriba a la derecha con un punto naranja pequeño de "no leído".
- **Sección de perfil** (centrada): avatar circular grande con botón de edición flotante pegado al borde; nombre de usuario; subtítulo "Collecting since {mes} {año}" (fecha de alta de la cuenta, campo `created` de `users`); CTA primario ancho completo "Editar perfil" (pill naranja).
- **Card "Resumen de tu colección"**: cinco tarjetas de estadística del mismo tamaño, cada una con icono naranja + número grande + etiqueta pequeña: **Gatos capturados**, **Favoritos**, **Ciudades exploradas**, **Días de racha**, **Ciudad más explorada** (esta última es texto, no número). Todas alineadas. *(Extensión decidida en 1.3: esta card gana un "Ver todos" en su cabecera, igual que Logros/Amigos, para no perder el gráfico de crecimiento ni el ranking que ya existían en `/stats`.)*
- **Card "Logros recientes"**: "Ver todos" arriba a la derecha; fila horizontal de badges circulares (círculo blanco, contorno naranja, icono naranja, título pequeño, fecha de desbloqueo pequeña debajo) — ejemplo: Primer gato, Racha de 7 días, Explorador, 100 fotos.
- **Card "Actividad reciente"**: timeline vertical con línea y puntos naranjas; cada item = foto circular del gato + título de la actividad + fecha + ubicación, con la miniatura alineada a la derecha; hito final destacado = círculo grande con contorno naranja y un número ("50") + texto ("¡Has alcanzado 50 gatos!") + chevron a la derecha.
- **Card "Amigos"**: subtítulo "Comparte tu pasión por los gatos 🐾"; "Ver todos" arriba a la derecha; lista horizontal donde el primer elemento es un círculo de borde discontinuo con "+" y label "Añadir amigo", seguido de avatar + nombre + "N gatos" por cada amigo; al final, pill ancho con borde naranja "Buscar amigos" con icono.
- **Interacción** (a implementar con las transiciones ya existentes en el proyecto, p. ej. `animate-fade-up`/`animate-pop-in` de `app/globals.css`): tocar el botón de perfil abre el editor; tocar un avatar de amigo abre su perfil; "Buscar amigos" abre el flujo de añadir amigo (Fase 2); "Añadir amigo" abre el mismo flujo; tocar un logro abre su detalle; tocar un item del timeline abre la ficha del gato (`/cat?id=...`); tocar la campana abre notificaciones.
- Restricciones explícitas del propio mockup: no inventar componentes nuevos de UI fuera de los ya usados en el proyecto, no sustituir iconos por otros estilos, no mover secciones, no comprimir el layout, sin Material Design / estética Android.

### 1.3 Implicaciones de datos — qué de esto ya existe y qué hay que construir

El mockup introduce varias piezas que **no tienen hoy una fuente de datos** en el código actual; hay que resolverlas antes de poder maquetarlas con datos reales (no hardcodear):

- **"Gatos capturados" / "Favoritos" / "Días de racha"**: ya calculados en `app/stats/page.tsx` (`stats.captured`, `favoriteCount`, `stats.currentStreak`) — reutilizar tal cual.

- **Decidido — "Ciudades exploradas" / "Ciudad más explorada"**: se geocodifica **en el momento de la captura**, no al cargar el perfil. Motivo: evita depender de un servicio externo en cada visita al perfil (más rápido, funciona con la app en modo casi-offline salvo por esa única llamada), es consistente con cómo ya se guardan `lat`/`lng`/`phash` en el mismo flujo de `app/capture/page.tsx`, y el coste de red es insignificante (una llamada por captura, no por vista). El desarrollo concreto queda detallado en la nueva **Fase 0.4** (campo `city` en `photos` + llamada a Nominatim en captura, best-effort y no bloqueante). Limitación aceptada: las fotos capturadas antes de este cambio no tendrán `city` y no contarán para "ciudades exploradas" — no hay backfill retroactivo en este plan.
  - `app/profile/page.tsx` calcula "Ciudades exploradas" = nº de valores únicos de `city` (no vacíos) entre las fotos del usuario, y "Ciudad más explorada" = la moda de ese mismo conjunto.

- **Decidido — "Actividad reciente" (timeline)**: no existe hoy ningún feed de actividad en el repo (tampoco en `app/page.tsx`, que solo pinta un grid de gatos) — se construye como una vista derivada, sin collection nueva ni cambio de schema:
  - Fuente de datos: las `photos` más recientes del usuario (evento "Capturaste {gato}", con `expand: "cat"` para nombre/miniatura y `lat`/`lng`/`city` para la ubicación mostrada), más las filas de `achievements` del usuario ordenadas por `unlockedAt` (evento de hito, p. ej. "¡Has alcanzado 50 gatos!" para `collector_10`/`collector_25`/`first_catch`, reutilizando `ACHIEVEMENT_DEFS[badgeCode].name` como texto).
  - Ambas listas se piden en paralelo (`Promise.all`), se combinan en un único array y se ordenan por fecha (`created` de `photos`, `unlockedAt` de `achievements`) descendente, cortando a los N más recientes (p. ej. 5–8, ajustar al ver cómo queda en el mockup real).
  - El hito grande con círculo naranja del mockup ("50") es simplemente el evento de tipo logro cuando aparece en esa lista combinada — no es un componente aparte, es el mismo item de timeline con una variante visual para el tipo "milestone" vs. el tipo "captura".

- **Decidido — Campana de notificaciones**: no hay sistema de notificaciones y no se construye infraestructura nueva para esto. El punto naranja de "no leído" se alimenta exclusivamente del nº de solicitudes de amistad pendientes entrantes (`listPendingIncoming()` de la Fase 2.1) — si es `0`, el punto no se muestra. Tocar la campana abre una `Sheet` que reutiliza la misma UI/acciones de "Solicitudes recibidas" de `/friends` (Fase 2.2) en vez de duplicarla; no hace falta una pantalla de "Notificaciones" independiente.

- **Decidido — "N gatos" por amigo**: v1 = una query por amigo en paralelo (`Promise.all`), cada una un `getList(1, 1, { filter: 'discoveredBy="${friendId}"', fields: "id" })` leyendo solo `totalItems` — sin añadir un contador materializado (`catCount`) a `users`. Motivo: CatDex está pensada para grupos reducidos de amigos (no una red social masiva), así que unas pocas queries en paralelo al abrir el perfil son aceptables sin necesidad de tocar el hook de scoring para mantener un contador redundante. Revisar esta decisión si en el futuro se observa que los usuarios acumulan decenas de amigos y la carga del perfil se resiente.

- **Logros recientes vs. logros completos**: la card del mockup solo muestra 3–4 logros recientes (badge circular simple, sin chip de rareza). El grid completo con rareza (`RARITY_STYLE` de `app/settings/achievements/page.tsx`) pasa a vivir detrás de "Ver todos" — mantenerlo como sub-vista (puede ser una `Sheet` a pantalla completa o una ruta `/profile/achievements`) en vez de duplicar el diseño.

- **Decidido — gráfico de crecimiento y ranking existentes** (`app/stats/page.tsx:166-180` y `:225-248`): se mueven detrás de un "Ver todos" en la cabecera de "Resumen de tu colección" (mismo patrón visual ya usado por el mockup en "Logros recientes" y "Amigos", así que no introduce un componente nuevo). Ese "Ver todos" abre una sub-vista "Estadísticas completas" con el selector de periodo, el `LineChart` de crecimiento, "Lugares explorados"/`ProgressRing` y el ranking, tal cual existen hoy — no se pierde funcionalidad, solo se saca de la vista principal para respetar el mockup al pie de la letra. Nada se elimina.

### 1.4 Logros sin emoji
- [ ] En `lib/achievements-defs.ts`, sustituir el campo `emoji: string` por `icon: string` (nombre de icono de `lucide-react`), coherente con el estilo "círculo blanco, contorno naranja, icono naranja" del mockup. Mapeo sugerido (ajustar si alguno no encaja visualmente):

  | badge | icono lucide-react |
  |---|---|
  | first_catch | `Cat` |
  | collector_10 | `Layers` |
  | collector_25 | `Crown` |
  | photographer_50 | `Camera` |
  | photographer_500 | `Aperture` |
  | lucky_day | `Dice5` |
  | night_owl | `Moon` |
  | early_bird | `Sunrise` |
  | explorer_3 | `Map` |
  | explorer_10 | `Compass` |
  | loyal_5 | `Heart` |
  | loyal_50 | `Repeat` |
  | rainy_day | `CloudRain` |
  | streak_7 | `Flame` |
  | streak_30 | `Trophy` |
  | namer | `PenLine` |
  | notekeeper | `NotebookPen` |
  | share_first | `Globe` |

- [ ] Resolver el string a componente vía un `Record<string, LucideIcon>` local (mismo patrón que `LEFT_ITEMS`/`RIGHT_ITEMS` en `components/BottomNav.tsx`), renderizado dentro del círculo con contorno naranja del badge (no como card cuadrada con grayscale, que es el estilo antiguo de `app/settings/achievements/page.tsx`).

### 1.5 Edición de perfil
- [ ] Sheet o pantalla "Editar perfil" (abierta desde el CTA del mockup): campo `name` (texto) + selector de avatar (`<input type="file">` disparando `pb.collection("users").update(id, formData)`) — hoy no existe ninguna forma de fijar estos campos, ni siquiera en `app/settings/account/page.tsx`.

### 1.6 Logros embebidos y limpieza de Settings
- [ ] Quitar la fila "Logros" de `app/settings/page.tsx:36` (ya no hace falta un destino separado) y borrar `app/settings/achievements/page.tsx` una vez migrado su contenido a la sub-vista "Ver todos" de la Fase 1.3.
- [ ] La carga de logros deja de recalcular condiciones en cliente: usar `pb.collection("achievements").getFullList({ filter: 'user="${userId}"' })` (dato real persistido en la Fase 0.3) tanto para "Logros recientes" (los N más nuevos por `unlockedAt`) como para la sub-vista completa.

**Criterio de fin de Fase 1**: `/profile` reproduce el mockup punto por punto (header con campana, sección de perfil editable, resumen de 5 estadísticas con datos reales incluida ciudad, logros recientes con iconos y fecha real, timeline de actividad reciente, sección de amigos con "Añadir amigo"/"Buscar amigos"); gráfico de crecimiento y ranking accesibles desde "Ver todos" de "Resumen de tu colección" sin pérdida de funcionalidad; `npm run lint && npm run build` pasan.

---

## Fase 2 — Sistema de amigos

### 2.1 `lib/friends.ts` (nuevo)
Funciones sobre `getPocketBase()`:
- `getMyInviteCode()` — lee `pb.authStore.record.inviteCode`.
- `resolveInviteCode(code)` — `pb.send("/api/catdex/resolve-invite", { method: "POST", body: { code } })`.
- `sendFriendRequest(addresseeId)` — crea `friendships` con `requester = self`.
- `acceptRequest(friendshipId)` — `update(id, { status: "accepted" })`.
- `declineRequest(friendshipId)` / `removeFriend(friendshipId)` — ambas son `delete(id)` (mismo endpoint, distinta etiqueta en UI según el estado).
- `listFriends()` — `getFullList({ filter: 'status="accepted" && (requester=self || addressee=self)' })`, mapeado a `{ id: friendshipId, friend: otherUser }` resolviendo `expand`.
- `listPendingIncoming()` / `listPendingOutgoing()` — mismo patrón filtrando `status="pending"` y `addressee=self` / `requester=self`.

### 2.2 `app/friends/page.tsx` (nueva)
- `TopBar back backHref="/profile"` (patrón de `app/settings/account/page.tsx:63`).
- Input/sheet "Añadir amigo": pega un código → `resolveInviteCode` → muestra preview (avatar+nombre) → confirmar → `sendFriendRequest`.
- Sección "Solicitudes recibidas": lista con botones aceptar/rechazar (`ConfirmDialog` no hace falta, son acciones reversibles/no destructivas salvo rechazar, que si se quiere confirmar puede llevar un `ConfirmDialog` ligero).
- Sección "Solicitudes enviadas" (pendientes de que la otra persona acepte) con opción de cancelar.
- Sección "Amigos": lista con avatar/nombre/score, botón eliminar → `ConfirmDialog` (destructivo) → `removeFriend`.

### 2.3 Puntos de entrada
- [ ] En `app/profile/page.tsx`, fila tipo `SettingsRow` "Amigos" con el nº de amigos como `value`, `href="/friends"`.
- [ ] Badge de nº de solicitudes pendientes junto al icono "Perfil" en `BottomNav` (opcional, solo si se quiere notificación visual sin infraestructura de push).

**Criterio de fin de Fase 2**: usuario A envía solicitud con el código de B; B la ve en "Solicitudes recibidas" y la acepta; ambos aparecen en la lista de amigos del otro; cualquiera puede eliminar la amistad.

---

## Fase 3 — Mapa: capturas de amigos

### 3.1 Filtro por defecto = solo mías
- [ ] `app/map/page.tsx:39`: cambiar `filterCatId ? cat="${filterCatId}" : "lat!=null"` para que el caso base sea `user="${pb.authStore.record.id}" && lat!=null` (y, si además hay `filterCatId`, combinarlo con `&&`).
- [ ] Nuevo estado `showFriends` (boolean), persistido en `localStorage` con el mismo patrón que `lib/sound-prefs.ts` (crear `lib/map-prefs.ts` análogo si se quiere mantener la convención).
- [ ] Cuando `showFriends` es true: obtener `listFriends()` (Fase 2.1), construir `user="me" || user="friend1" || user="friend2" ...` (o dos llamadas por separado — más simple: una query para "mías", otra para "de amigos", y mergear en cliente marcando cada `MapMarkerData` con `isOwn: boolean`).

### 3.2 UI del filtro
- [ ] En la `Sheet` de filtro (`app/map/page.tsx:145-174`), añadir **antes** del listado "Filtrar por gato" una fila con `Toggle` (componente existente): "Mostrar capturas de amigos", con su valor ligado a `showFriends`.
- [ ] El filtro por gato (`filterCatId`) sigue funcionando igual, pero ahora opera sobre el conjunto ya restringido (mías, o mías+amigos si el toggle está activo) — el listado de "gatos con ubicación" del selector debe derivarse de ese mismo conjunto combinado, no de una carga global aparte.

### 3.3 Color distinto para amigos
- [ ] Añadir un token nuevo en `app/globals.css` junto a `--color-catdex-orange` (línea ~11): `--color-catdex-blue: #3B82F6;` (o el tono que encaje con la paleta — revisar contraste sobre `--color-catdex-cream`).
- [ ] `components/LeafletMap.tsx`: extender `MapMarkerData` con `isOwn: boolean`. `createCatIcon(thumbUrl, isOwn)` usa el ring naranja (`#FF8A26`) si `isOwn`, o el nuevo azul si no. Para `createClusterIcon`, si un cluster mezcla marcadores propios y de amigos, usar un tercer color neutro (p. ej. gris `catdex-gray-light`) para no mentir sobre la composición — documentar esta decisión con un comentario corto si no es obvio.
- [ ] `app/map/page.tsx`: al construir `enriched` (línea ~46-60), añadir `isOwn: p.user === pb.authStore.record?.id`.

### 3.4 Sheet de detalle de pin
- [ ] `app/map/page.tsx:114-142`: si `!selectedMarker.isOwn`, añadir el nombre del amigo dueño de la captura (requiere `expand: "cat,user"` en la query, ya se pide `expand: "cat"` — añadir `user`).

### 3.5 Reforzar las reglas de backend (recomendado antes de publicar)
El filtro del punto 3.1 es solo del lado cliente: hoy `photos.listRule` es `@request.auth.id != ""`, así que cualquier usuario autenticado puede seguir pidiendo por API las fotos de alguien que no es su amigo, aunque la UI ya no se las ofrezca. Si la privacidad debe ser real y no solo cosmética:
- [ ] Cambiar `photos.listRule`/`viewRule` a algo como: `user = @request.auth.id || @collection.friendships.status = "accepted" && ((@collection.friendships.requester = @request.auth.id && @collection.friendships.addressee = user) || (@collection.friendships.addressee = @request.auth.id && @collection.friendships.requester = user))`.
- [ ] Validar la sintaxis exacta contra la versión de PocketBase desplegada (las expresiones de "back-relation" entre collections son sensibles a la versión) antes de aplicarla en producción — probar primero contra una instancia local/staging.
- [ ] Aplicar la misma idea a `cats.listRule` si se considera que el "quién descubrió qué gato" también debe limitarse a amigos.

Marcar esta subfase como negociable con el usuario: endurecer las reglas puede romper otros flujos que hoy asumen que la colección es abierta a todo autenticado (p. ej. el ranking global en `app/profile` sigue necesitando leer `score` de todos los `users`, que es un campo distinto y no se ve afectado).

**Criterio de fin de Fase 3**: por defecto el mapa de un usuario nuevo (sin amigos) solo muestra sus propias capturas; activar el toggle añade las de sus amigos aceptados en color distinto; el filtro por gato sigue funcionando combinado con el toggle.

---

## Fase 4 (opcional, confirmar alcance) — Compartir una captura fuera de la app

El pedido original menciona "compartir tus capturas de manera más fácil" además del sistema de amigos. Las Fases 2-3 ya cubren el caso "que mis amigos vean mis capturas dentro de la app". Si además se quiere poder compartir una ficha de gato concreta hacia fuera (WhatsApp, etc.):
- [ ] Añadir un botón "Compartir" en `app/cat/page.tsx` que use la Web Share API (`navigator.share`) con la foto y un texto corto; fallback a copiar un enlace si `navigator.share` no está disponible (Safari desktop, etc.).
- [ ] Decidir si el enlace compartido debe ser públicamente visible sin login (rompería el modelo actual, todo requiere `@request.auth.id != ""`) o solo un texto/imagen sin enlace funcional dentro de la app.

No implementar sin confirmación explícita — depende de si se quiere abrir una superficie pública nueva en una app que hoy es 100% autenticada.

---

## Resumen de dependencias

- Fase 0 bloquea todo lo demás (schema + hooks tienen que existir antes de que el cliente pueda usarlos).
- Fase 1 es independiente de Fase 2/3 salvo por: el hook de logros de 0.3 (para "Logros recientes" con fecha real), y `listPendingIncoming()` de 2.1 (para el punto de la campana de notificaciones) — la card de Amigos del mockup también necesita que 2.1/2.2 existan para tener datos reales en vez de vacíos.
- La geocodificación de ciudad (Fase 1.3) es una decisión y un desarrollo aparte que no depende de las Fases 0/2/3, pero bloquea que "Ciudades exploradas"/"Ciudad más explorada" muestren datos reales — puede entregarse con placeholder ("—") mientras se decide el enfoque.
- Fase 2 depende de 0.1 y 0.2 (collection `friendships` + ruta de resolución de código).
- Fase 3 depende de 2.1 (`listFriends()`) y, si se hace 3.5, de que las reglas de `photos` no rompan el resto de la app — probar exhaustivamente antes de aplicar en producción.
- Fase 4 es independiente y opcional.

## Fuera de alcance (no tocar sin pedirlo explícitamente)
- Los 8 badges de `lib/achievements-defs.ts` que hoy no tienen lógica de cálculo en ningún sitio (`lucky_day`, `loyal_5`, `loyal_50`, `rainy_day`, `streak_7`, `streak_30`, `share_first`) — necesitan datos o infraestructura adicional (clima, tracking de comparticiones, rachas por gato individual).
- Notificaciones push para solicitudes de amistad — no hay infraestructura hoy.
- Cualquier endurecimiento de reglas de `cats`/cambios de Fase 0 del `IMPROVEMENT_PLAN.md` existente que no esté directamente relacionado con amigos/perfil/logros — son planes independientes, no mezclar en el mismo PR.
