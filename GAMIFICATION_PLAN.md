# CatDex — Plan de gamificación máxima (2026-07-30)

Objetivo: convertir CatDex de "app de colección" a "juego social diario" — el mecanismo de enganche no es la app en sí, es **tus amigos**: compartir hallazgos, celebrar hitos juntos, sentir que la colección crece en compañía.

Escrito para que un agente lo ejecute fase a fase. Antes de tocar código, revisar `CODE_REVIEW_2026-07-30.md` (deuda técnica ya identificada que algunas fases de aquí tocan: hooks no transaccionales, sin paginación en `achievements-utils.js`).

> **Recalibrado el 2026-07-30** (dos rondas de feedback): la competencia entre amigos está bien y se espera — lo único descartado explícitamente es cualquier mecánica de **mapa/territorio** (guerra de zonas, "pintar" el barrio). Ranking/liga entre amigos y duelos 1 a 1 vuelven a estar en alcance. Además se añade un sistema de **compartir capturas** (con amigos dentro de la app + enlace público externo) pedido explícitamente.

## Lo que ya existe (no reinventar)

- **Puntos**: `pb_hooks/scoring.pb.js` — 50pts primera foto de un gato, 10pts las siguientes. Server-side, ya blindado.
- **Logros**: 18 definidos en `lib/achievements-defs.ts`, con rareza (Común/Raro/Épico/Legendario) e icono. **13 se evalúan** server-side (`pb_hooks/achievements-utils.js`) — `streak_7`/`streak_30` se añadieron en la Fase A junto al streak; quedan 5 sin calcular: `lucky_day`, `loyal_5`, `loyal_50`, `rainy_day`, `share_first`.
- **Racha (streak)**: el dato ya se calcula — pero solo client-side y solo dentro de `/profile/stats` (`currentStreak`/`bestStreak` en base a fechas de `photos`). No hay presión de "no la rompas" en ningún sitio visible del día a día.
- **Ranking**: `/profile/stats` lista todos los usuarios por `score` — global, no por grupo de amigos, no tiene corte temporal (siempre acumulado histórico).
- **Amigos**: sistema completo (solicitudes, mapa compartido con color distinto). Sin ninguna interacción social más allá de "ver dónde ha estado".
- **Notificaciones**: `app/settings/notifications/page.tsx` ya pide permiso del navegador y guarda preferencias (recordatorios/logros/actividad) — pero es **solo la UI**. No hay Web Push real: ni suscripción guardada en PocketBase, ni nada que la dispare. El service worker (`public/sw.js`, registrado en `app/layout.tsx`) no tiene un handler de evento `push`.
- **Celebración de captura**: confetti + sonido al guardar (`lib/sounds.ts`), pero **no** hay aviso inmediato si esa captura desbloqueó un logro — el usuario se entera si por casualidad visita `/profile` más tarde.

## Principios de diseño

1. **El loop de recompensa debe cerrarse en el momento**, no en la siguiente visita — si capturar un gato desbloquea un logro o sube de racha, eso se ve en el mismo instante (Fase A).
2. **Competir con amigos está bien; el mapa no es el terreno de juego** — ranking, ligas y duelos entre amigos son bienvenidos. Lo único fuera de la mesa es convertir el mapa en un tablero de territorio/zonas — el mapa se queda como lo que es hoy (dónde ha estado cada uno), no como un marcador de "quién controla el barrio".
3. **Nunca penalizar borrando progreso real** — nada de "pierdes gatos de tu colección si no entras". El enganche es por diversión/logro, no por castigo destructivo.
4. **Todo lo que dé puntos/logros sigue siendo server-side** (hooks), nunca confiar en el cliente — ya es el patrón establecido en `scoring.pb.js`/`achievements.pb.js`, mantenerlo sin excepción.

---

## Ideario ampliado — más mecánicas, organizadas por pilar

Más allá de las 4 fases originales. Todo lo de aquí abajo es **candidato a incorporarse** a las fases (o a formar una Fase E) una vez el usuario elija cuáles quiere formalizar — no todo hay que construirlo, pero conviene tener el catálogo completo antes de decidir qué se queda fuera.

### 🎮 Gamificación — que coleccionar y progresar enganche por sí solo

1. **Cat-dex regional con % de completado real** — barra "Has descubierto el 34% de los gatos conocidos en tu zona", comparando tu colección contra el total de gatos únicos avistados por cualquiera en un radio configurable (no solo tus amigos). Se apoya en `lat`/`lng`/`city` ya guardados; convierte la app en una Pokédex de verdad, no en un álbum personal.
2. **Rasgos coleccionables por gato** — al guardar una captura, un selector rápido de chips (color: negro/blanco/naranja/atigrado/calico/tricolor, ¿lleva collar?) etiqueta el gato. Desbloquea "sets" tipo cartas coleccionables ("Set Atigrados completo" = badge especial) — profundidad de colección sin depender de que la IA reconozca razas, que hoy no puede.
3. **Rango visible en todas partes**, no solo en el perfil — Novato 🐾 → Cazador 🎯 → Guardián de la Colonia 🛡️ → Leyenda Callejera 👑, junto al nombre en la lista de amigos y futuros comentarios/reacciones. Es un título de progreso personal (como un nivel), no una comparación con nadie — un rango que se ve constantemente pesa mucho más que uno enterrado en una pantalla.
4. **Combos de captura** — dos gatos distintos en menos de 30 minutos = "combo x2" con animación y puntos extra, mostrado en el momento (refuerzo inmediato, como un multiplicador de videojuego de acción, no algo que descubres después en stats).
5. **Cofre de hito** — cada 10 gatos o cada logro Legendario, una animación de "cofre" que se abre con confetti revelando qué cosmético nuevo (marco de avatar, color de nombre) se desbloqueó. Mismo gancho psicológico que una loot box, pero sin azar real de por medio — siempre hay premio, la sorpresa es cuál.

### 🏆 Competencia sana — rankings y duelos entre amigos (nunca en el mapa)

6. **Ranking semanal entre amigos** — como el C.1 original: `score` de la última semana, solo entre tus amigos aceptados, con reset cada lunes. Sin divisiones Bronce/Plata/Oro (eso sí quitado) — un top simple de tu grupo, competitivo pero sin castigo de "bajar de categoría".
7. **Duelos 1 a 1** — un amigo reta a otro a "quién captura más en 7 días", con notificación de inicio y de resultado. Vuelve a estar en alcance, solo el mapa queda descartado como mecánica.
8. **Racha en pareja** (estilo "streak" de Snapchat): tú y un amigo concreto mantenéis una cuenta de "semanas seguidas en las que ambos habéis capturado algo" — mezcla competencia suave (no la rompas tú) con vínculo social (no dejes tirado al otro).

### 🤝 Cooperación — que sumar entre amigos también tenga su hueco

9. **Colonia compartida** — un contador colectivo de tu grupo de amigos: "Entre todos habéis descubierto 87 gatos" con una barra de progreso hacia el siguiente hito colectivo (100, 250, 500). Al llegar, **todos** los del grupo desbloquean el mismo cosmético/badge a la vez.
10. **Objetivo de grupo con temporizador** — "Entre todos, 50 gatos esta semana" para tu grupo de amigos, con una barra de progreso colectiva y celebración conjunta al conseguirlo.
11. **Postal/regalo entre amigos** — puedes "dedicar" una captura a un amigo con un mensaje corto ("sé que te encantan los negros, mira este") — gesto social cálido y unidireccional, complementa al ranking/duelos sin depender de ellos.

### 👥 Social/Amigos — que la app se sienta viva aunque tú no captures hoy

12. **Reacciones variadas** — 🐾❤️😻😂 en vez de una sola, más expresividad con el mismo coste de implementación.
13. **Empujón entre amigos** — un amigo te manda un toque directo ("Pedro te ha recordado seguir tu racha 🔥") en vez de que solo el sistema te avise. La presión social de una persona real pesa mucho más que una notificación automática, y es gratis en infraestructura una vez existe el Web Push de la Fase A.
14. **Feed de actividad de amigos en el home** — no solo tu propia actividad reciente (ya en `/profile`), sino lo que tus amigos han capturado hoy, para que abrir la app se sienta viva incluso los días que tú no sales a capturar.
15. **Descubrimiento compartido** — si tú y un amigo fotografiáis el mismo gato (mismo `phash`) por separado, se marca en ambos perfiles como "descubierto también por [amigo]" — convierte una coincidencia en un momento social memorable, con datos que ya se calculan (`similarity` de pHash).
16. **Gato destacado de la semana** — tu grupo de amigos vota con reacciones (punto 12) la foto que más les ha gustado; se celebra como "destacado" temporal en el perfil de quien gana.
17. **Resumen semanal compartible** — mini "Story" de tu semana (fotos + hitos + puesto en el ranking de amigos) pensado para compartir fuera de la app, conectando con el sistema de shares de abajo.

### 🔗 Compartir capturas — pedido explícitamente, dos canales

18. **Compartir dentro de la app**: al compartir una foto/ficha de gato, se notifica a tus amigos (push + entrada en su feed de actividad) y aparece contabilizado en la **campanita de notificaciones del perfil** — ahora mismo esa campana solo cuenta solicitudes de amistad pendientes; pasa a ser un contador combinado (solicitudes + comparticiones nuevas + reacciones nuevas cuando existan).
19. **Compartir con link público**: un enlace externo que cualquiera puede abrir (incluso sin cuenta ni login) y ver la ficha de ese gato — foto, nombre, notas si el dueño lo permite, quién lo descubrió. Esto era una pregunta abierta sin resolver en `FRIENDS_PLAN.md` Fase 4 ("¿debe verse sin login? rompería el modelo 100% autenticado") — **ahora sí, se pide explícitamente**.

---

## Fase A — Cerrar el loop ya existente (mayor impacto, menor esfuerzo)

### A.1 Racha visible y con presión real
- Mover el cálculo de streak de `/profile/stats` a un lugar visible a diario: banner/chip en el home (`app/page.tsx`) tipo "🔥 3 días seguidos — captura hoy para no perderla".
- Server-side: exponer `currentStreak` sin recalcular en cliente en cada carga — puede vivir como campo derivado en `users` (`currentStreak`, `lastCaptureDate`) actualizado por el mismo hook de `scoring.pb.js` en cada foto, en vez de recalcularlo escaneando todas las fotos cada vez (evita el problema de escalabilidad ya señalado en `CODE_REVIEW_2026-07-30.md` para `achievements-utils.js`).
- Regla de negocio a decidir con el usuario: ¿la racha se rompe a medianoche hora local o a las 24h desde la última captura? Recomendado: medianoche local, más fácil de comunicar ("hoy" vs "ayer").

### A.2 Notificación instantánea de logro desbloqueado
- Al guardar una foto (`app/capture/page.tsx` `saveCat`), el hook de logros ya corre server-side en el mismo request — solo falta que la respuesta se lo diga al cliente. Opción más simple sin tocar el modelo de datos: tras `photos.create()`, el cliente hace un `getFullList` de `achievements` filtrando por `unlockedAt` posterior al timestamp de inicio de la captura, y si hay alguno nuevo, muestra el modal de celebración (`BadgeUnlock`, hoy sin usar — está listado como huérfano en el plan de limpieza anterior, aquí se reactiva con propósito real).
- Alternativa más robusta: que la ruta de creación de fotos use una PocketBase custom route (`routerAdd`) en vez de la API genérica de collections, para poder devolver `{ photo, newAchievements: [...] }` en una sola respuesta — más trabajo, pero evita el segundo round-trip y la ventana de carrera del polling por timestamp.

### A.3 Web Push real
- Añadir `push` handler a `public/sw.js` + flujo de suscripción: botón en `/settings/notifications` que pida permiso y guarde la `PushSubscription` en una nueva collection `push_subscriptions` (`user`, `endpoint`, `keys`).
- **Validado**: PocketBase JSVM (goja) no puede firmar JWTs VAPID/ES256 — es un motor ES5 puro sin módulo crypto real, así que la firma no se puede hacer dentro de un `pb_hook`. La comunidad de PocketBase resuelve esto de dos formas: (a) un plugin de Go compilado dentro del propio binario de PocketBase con `webpush-go`, o (b) el hook llama por HTTP a un servicio externo que sí tenga un runtime Node/Go con librería de Web Push, y ese servicio hace la firma y el envío.
  - Para CatDex, la opción (b) más barata es añadir **una única ruta interna en el Next.js ya desplegado** (`output: "standalone"`, corre como proceso Node persistente en CT 120 junto a PocketBase) — algo como `app/api/push/send/route.ts` usando el paquete npm `web-push`. El hook de PocketBase (cron o `onRecordAfterCreateSuccess`) le hace un `fetch()` interno con `{ subscription, payload }` y esa ruta hace la firma VAPID real.
  - Esto rompe, de forma puntual y justificada, la característica de "sin `app/api/*`" que describían `IMPROVEMENT_PLAN.md`/`FRIENDS_PLAN.md` — es la única pieza de todo el plan que necesita ejecutarse en un runtime con crypto real. Alternativa (a) evita tocar Next.js pero obliga a compilar y desplegar un binario de PocketBase a medida en vez de solo copiar `pb_hooks/*.pb.js` — más trabajo operativo para lo que gana.
- PocketBase no tiene un enviador de push nativo — necesita un hook con `cronAdd` (cron nativo de PocketBase, hoy sin usar en `pb_hooks/`) que, cada día a una hora fija, recorra usuarios con racha activa que no han capturado hoy y llame a la ruta de envío para mandarles "🔥 Tu racha de N días se rompe hoy".

### A.4 Completar los logros pendientes
- ✅ `streak_7` / `streak_30`: hecho — `achievements-utils.js` ya lee `users.currentStreak` y compara contra el umbral.
- `loyal_5` / `loyal_50`: "revisitas el mismo gato N veces" — contar fotos por `cat` agrupadas, ya se tienen los datos en `achievements-utils.js` (`photos` del usuario), falta agrupar por `cat` y comparar el máximo.
- `rainy_day`: ya se consulta el clima en `app/cat/page.tsx` (Open-Meteo) pero solo para mostrarlo, no se persiste. Igual que con `city` (Fase 0.4 de `FRIENDS_PLAN.md`), habría que resolverlo en el momento de la captura y guardar un flag `rainy: boolean` en `photos` para que el hook lo pueda evaluar server-side.
- `lucky_day`: sin definición de negocio clara todavía — placeholder en el diseño original. Propuesta: se dispara con una probabilidad baja (p. ej. 5%) en cada captura, servidor-side en el mismo hook (nunca en cliente, para que no se pueda forzar).
- `share_first`: requiere trackear que el usuario ha usado el botón "Compartir" (`app/cat/page.tsx` `share()`) al menos una vez — hoy no se registra en ningún sitio. Mínimo: un endpoint/registro simple que el hook de logros pueda leer.

**Criterio de fin de Fase A**: capturar una foto muestra en el momento si desbloqueaste un logro o subiste de racha; la racha es visible en el home todos los días; los 18 logros están todos implementados de verdad.

---

## Fase B — Progresión y estatus (para que "subir" se sienta bien)

- **Rangos/niveles por score**: título visible en el perfil (Novato → Cazador → Guardián de la Colonia → Leyenda Callejera) por umbrales de `score`, mostrado junto al avatar — reutiliza el dato que ya existe (`users.score`), es una tabla de mapeo en el cliente, cero cambios de backend.
- **Vitrina de rareza colaborativa**: un gato "raro" no depende de IA (coco-ssd no distingue razas) — se define por señales que sí tenemos: cuántos usuarios distintos lo han fotografiado. Un gato visto por 1 solo usuario es "tuyo"; visto por 3+ usuarios es "Gato Legendario de la colonia" — dato derivable de `photos.user` agrupado por `cat`, mostrable en `app/cat/page.tsx`.
- **Cosméticos desbloqueables**: marco de color en el avatar según el logro de mayor rareza conseguido (Legendario = marco dorado) — puramente visual, sin nueva collection, se deriva de `achievements` en el cliente.

**Criterio de fin de Fase B**: el perfil comunica progreso más allá del número crudo de score; hay una razón visual para perseguir logros Épicos/Legendarios.

---

## Fase C — Social: competencia, cooperación y compartir (el gancho que pediste)

### C.1 Ranking semanal y duelos entre amigos
- Ranking que resetea cada lunes, solo entre tus amigos aceptados — cron de PocketBase (`cronAdd`, semanal) que congela el `score` de cada usuario el domingo a medianoche en una nueva collection `weekly_snapshots` (`user`, `weekAt`, `scoreAtSnapshot`); el ranking de la semana = `score actual - scoreAtSnapshot`, filtrado a `listFriends()`. Sin divisiones/ascenso-descenso — un top simple, sin castigo por bajar puestos.
- Duelos 1 a 1: un amigo reta a otro a "quién captura más en 7 días" — collection `duels` (`challenger`, `opponent`, `startsAt`, `endsAt`, `challengerScore`, `opponentScore`), cerrada por el mismo cron semanal o uno propio. Notificación de inicio y de resultado.
- El mapa **no** participa de esto — sigue mostrando solo dónde ha estado cada uno, nunca "territorio" de nadie.

### C.2 Colonia compartida (objetivo de grupo)
- Contador colectivo por grupo de amigos: suma de gatos descubiertos entre todos los miembros, con barra de progreso hacia el siguiente hito (100/250/500). Al alcanzarlo, **todos** desbloquean el mismo cosmético.
- Modelo de datos: no necesita collection nueva si "grupo de amigos" se define como "tú + tus amigos directos" — se calcula sumando `cats`/`photos` de `listFriends()` + propio, sin persistir nada nuevo salvo el registro de qué hitos de grupo ya se celebraron (para no repetir el confetti).

### C.3 Reacciones en capturas de amigos
- Collection nueva `reactions` (`photo`, `user`, `emoji` — empezar solo con 🐾, ampliar según ideario punto 12). Botón de reacción en el detalle de foto/gato cuando `!isOwner`.
- Notificación push (Fase A.3) cuando alguien reacciona a una foto tuya.

### C.4 Descubrimiento compartido y postales
- Descubrimiento compartido (ideario punto 15): al guardar una foto, comprobar si otro usuario ya tiene un `phash` muy similar guardado y, si es amigo, marcar ambos registros como "también descubierto por [amigo]".
- Postal/regalo (ideario punto 11): acción "Enviar como postal" desde el detalle de un gato, con mensaje corto, notificando al amigo destinatario.

### C.5 Sistema de compartir capturas — pedido explícito, dos canales — ✅ hecho (Fase A)
Notificación push real (empujar el aviso cuando la app está cerrada) queda pendiente de A.3 — hoy la notificación es in-app únicamente (campana + feed), como decía el plan B de "Consideraciones técnicas".

Esta es la pieza más concreta de todo el plan (especificación cerrada, no solo idea):

**Modelo de datos**: nueva collection `shares` (`id`, `cat` → relation a `cats`, `sharedBy` → relation a `users`, `token` — text único generado al crear, `created`). `createRule`: `@request.auth.id != "" && sharedBy = @request.auth.id && cat.discoveredBy = @request.auth.id` (solo el descubridor puede compartir su propio gato, mismo criterio de ownership que edición/borrado en `app/cat/page.tsx`). `listRule`/`viewRule`: igual que `friendships`, restringido — el acceso público real no pasa por aquí (ver más abajo).

**Canal 1 — dentro de la app**: al crear una fila en `shares`, un hook (`pb_hooks/shares.pb.js`, `onRecordAfterCreateSuccess`) notifica a los amigos del que comparte (push, Fase A.3, + entrada en su feed de actividad del punto 14). Esto es también el momento de generalizar la campana de notificaciones: hoy (`app/profile/page.tsx`) solo cuenta `pendingIncoming.length` (solicitudes de amistad); pasa a necesitar una fuente combinada. Opción más limpia: nueva collection `notifications` (`user`, `type`: `"friend_request" | "share" | "reaction"`, `refId`, `read`, `created`), escrita por los hooks correspondientes cada vez que pasa algo notificable — la campana pasa a contar `notifications` no leídas en vez de recalcular ad-hoc desde varias collections.

**Canal 2 — enlace público externo**: la parte que rompe con el modelo 100% autenticado de la app, a propósito y por petición explícita.
- Ruta pública en PocketBase: `routerAdd("GET", "/api/catdex/shared/{token}", ...)` en `pb_hooks/shares.pb.js`, ejecutada con privilegios de servidor (`$app`, sin requerir `@request.auth`) — busca la fila de `shares` por `token`, resuelve el `cat`/`photo`/`discoveredBy` asociados y devuelve **solo** campos seguros: `{ catName, photoUrl, notes (si el dueño lo permite), discovererName, capturedAt }` — nunca email, nunca `score`, nunca otros gatos del usuario. Igual que `resolve-invite` (`pb_hooks/invite-codes.pb.js`), la seguridad está en que la ruta decide qué exponer, no en abrir `listRule`/`viewRule` de `cats`/`photos` al público.
- Página pública en Next.js: `app/s/[token]/page.tsx` (o `/share/[token]`), **sin** `useRequireAuth` — es la única ruta de toda la app pensada para visitantes sin cuenta. Consume la ruta pública de arriba, muestra la ficha en modo solo-lectura, y un CTA para "Únete a CatDex" que lleva a `/login` (gancho de crecimiento orgánico: cada link compartido es una invitación pasiva).
- Botón "Compartir" ya existente en `app/cat/page.tsx` (`share()`, hoy usa `navigator.share` con la URL actual de la app, que no es pública) pasa a: crear la fila en `shares` si no existe ya una para ese gato, construir la URL pública (`/s/{token}`), y esa es la URL que entra en `navigator.share`/portapapeles — resuelve la pregunta abierta que dejó `FRIENDS_PLAN.md` Fase 4 sin decidir.

**Criterio de fin de Fase C**: hay ranking/duelos entre amigos sin que el mapa participe; compartir una captura notifica a tus amigos dentro de la app (contador en la campana) y genera un link real que cualquiera puede abrir sin cuenta para ver esa ficha.

---

## Fase D — Retención a largo plazo (pulido, después de validar A-C)

- **Eventos de temporada**: logro exclusivo por tiempo limitado (p. ej. "Gato negro de Halloween", solo desbloqueable en fechas concretas) — collection `events` con `startsAt`/`endsAt`, mismo patrón de hook que achievements.
- **Resumen semanal tipo "Wrapped"**: notificación/pantalla los domingos con un resumen personal ("Esta semana: 5 gatos nuevos, tu racha más larga fue de 4 días, tu grupo llegó a 120 gatos entre todos") — solo datos propios y de grupo, nunca "quedaste por delante/detrás de X".
- **Recompensa por invitar amigos**: puntos extra cuando un código de invitación (`lib/friends.ts` `resolveInviteCode`) resulta en que el invitado haga su primera captura — requiere que el hook de scoring sepa quién invitó a quién (guardar `invitedBy` en `users` al aceptar la primera amistad, o al usar el código).

---

## Consideraciones técnicas transversales

- **PocketBase cron nativo** (`cronAdd` en JSVM) no se usa hoy en `pb_hooks/` — es el bloque que falta para: recordatorio diario de racha (A.3), reset semanal de ranking/duelos (C.1), celebración de hitos de colonia compartida (C.2), expiración de eventos (D). Validar primero con una prueba simple (un cron que solo loguee) antes de construir encima.
- **Web Push real es la pieza de infraestructura más grande de todo el plan** (A.3) — sin ella, C.3 (reacciones), C.5 (shares) y buena parte de A pierden fuerza porque dependen de traer al usuario de vuelta cuando la app está cerrada. Si el esfuerzo de VAPID no compensa a corto plazo, hay un plan B más barato: notificaciones "in-app" únicamente (badge en el icono de perfil, ya parcialmente hecho) — enganchan menos pero no necesitan servidor de push.
- **Rendimiento de hooks**: `achievements-utils.js` ya recalcula todo el historial del usuario en cada foto (señalado en `CODE_REVIEW_2026-07-30.md`). Cualquier lógica nueva de racha/ranking/colonia compartida debe evitar el mismo patrón — preferir campos derivados actualizados incrementalmente (`users.currentStreak`) sobre recalcular desde cero.
- **Anti-abuso**: rachas, ranking, duelos y logros son terreno fértil para hacer trampa si algo se calcula en cliente — todo lo nuevo debe seguir el mismo patrón de `scoring.pb.js`/`achievements.pb.js` (cálculo y escritura solo server-side).
- **El enlace público (C.5) es la única superficie sin autenticación de toda la app** — revisar que la ruta pública (`pb_hooks/shares.pb.js`) nunca devuelva más campos de los listados explícitamente; un `SELECT *` accidental ahí filtraría datos privados a cualquiera con el link.

## Prioridad recomendada (máximo enganche por esfuerzo)

1. **A.1 Racha visible + A.2 notificación instantánea de logro** — cierran el loop de recompensa ya existente, esfuerzo bajo, sin infraestructura nueva.
2. **C.5 Sistema de compartir capturas** — es la pieza pedida con especificación más concreta (dos canales, in-app + link público); además el link público es un gancho de crecimiento orgánico (cada share es una invitación pasiva a gente sin cuenta).
3. **A.3 Web Push real** — habilita C.5 (notificar shares) y todo lo demás que depende de traer al usuario de vuelta; arquitectura ya validada (ruta interna en Next.js con `web-push`).
4. **C.1 Ranking semanal + duelos entre amigos** — el gancho competitivo que pediste, sin tocar el mapa.
5. **A.4 Completar los 7 logros** — cierra un hueco ya detectado, esfuerzo medio.
6. **B (rangos/rareza/cosméticos) y C.2 (colonia compartida)** — barato, mejora la sensación de progreso mientras se valida lo anterior.
7. **C.3/C.4 (reacciones, descubrimiento compartido, postales) y Fase D** — una vez el resto esté validado y se vea que la gente vuelve.

## Fuera de alcance (no implementar sin pedirlo explícitamente)
- Cualquier mecánica que penalice borrando progreso ya conseguido (perder gatos, resetear score) — mata la confianza en la colección, que es el activo principal de la app.
- **Cualquier mecánica de mapa/territorio** (guerra de zonas, "pintar" el barrio de tu color) — la única exclusión explícita del usuario (2026-07-30). El mapa se queda como está: dónde ha estado cada uno, nada de competir por él.
- Monetización / compras (cosméticos de pago, pases de temporada) — no pedido, cambia el carácter de la app.
