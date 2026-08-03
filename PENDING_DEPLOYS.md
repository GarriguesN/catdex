# Deploys pendientes de rebuild en CT 120

Fecha: 2026-08-03

CT 120 tiene 512 MB RAM, 1 CPU. Build de Next 16 con Turbopack OOMea en
este perfil (mismo patrón que CT 119/GarageLedger). Por política del
proyecto: rebuild local + rsync, no `npm run build` in-place.

Cambios de cliente acumulados pendientes de rebuild:

| Commit | Archivos | Por qué |
|---|---|---|
| 0f99147 | lib/duels.ts | Fallback frozen/legacy en listMyDuels |

Procedimiento cuando se decida ejecutar el rebuild:
1. Build local: `cd /root/catdex && npm run build`
2. Rsync a CT 120: `.next/`, `server.js`, `public/`
3. `ssh root@192.168.1.200 'pct exec 120 -- systemctl restart catdex'`
4. Verificar: `curl -I https://catdex.nglab.es/` y `curl https://catdex.nglab.es/api/health`

Nota: no hay duelos terminados en producción (verificado 2026-08-03, 0
filas en `duels`), por lo que el cambio de cliente no tiene efecto
visible hasta que se cierre el primer duelo post-deploy.
