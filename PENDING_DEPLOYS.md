# Deploys pendientes de rebuild en CT 120

**Estado 2026-08-03 20:18 UTC: VACÍO — todos los commits pendientes han sido desplegados.**

Último deploy completo aplicado al servicio `catdex` (Next.js standalone):
- Build local: `npm run build` en `/root/catdex` (8 GB RAM)
- Paquete: `.next/` + `server.js` + `public/` → `/tmp/catdex-build.tgz` (32 MB)
- Transfer: `cat | ssh sshpass ... pct exec 120` (stdin del ssh)
- Deploy: `cp -r next/.next /opt/catdex/` + `cp server.js /opt/catdex/` + restart
- Verificado: `https://catdex.nglab.es/` HTTP 200, `/competition` 200, `/api/catdex/health` 200

Commits incluidos en este rebuild:
- `0f99147` (1.2) — lib/duels.ts fallback frozen/legacy
- `5273123` (1.5) — fixes cliente (autoCancel, getWeeklyRanking(friends?), authRefresh, hasSnapshot, UI prep)
- `f68aece` (1.6) — clamp cliente/servidor + contrato cross-side
- `2d12b69` (2.3) — ranking global (getGlobalRanking + getMyGlobalRank + Podium component)

Pendientes (si hubiera): vacío.

## Procedimiento para futuros deploys

1. Build local:
   ```bash
   cd /root/catdex
   npm run build
   ```

2. Empaquetar output:
   ```bash
   rm -rf /tmp/catdex-build && mkdir -p /tmp/catdex-build
   cp -r .next /tmp/catdex-build/next/.next
   cp .next/standalone/server.js /tmp/catdex-build/server.js
   cp -r public /tmp/catdex-build/public
   cd /tmp && tar czf catdex-build.tgz catdex-build/
   ```

3. Transferir al CT 120 (CT 120 está detrás de Proxmox; `scp` al FS del host no llega al FS del CT, hay que pipe-ar por stdin):
   ```bash
   cat /tmp/catdex-build.tgz | sshpass -p 'YN6!q@tewJ6pHD' ssh root@192.168.1.200 \
     'pct exec 120 -- /bin/bash -c "cat > /tmp/catdex-build.tgz && cd /tmp && tar xzf catdex-build.tgz"'
   ```

4. Aplicar y reiniciar:
   ```bash
   sshpass -p 'YN6!q@tewJ6pHD' ssh root@192.168.1.200 \
     'pct exec 120 -- /bin/bash -c "cd /tmp/catdex-build && cp -r next/.next /opt/catdex/ && cp server.js /opt/catdex/server.js && cp -r public/. /opt/catdex/public/"'
   sshpass -p 'YN6!q@tewJ6pHD' ssh root@192.168.1.200 'pct exec 120 -- /bin/systemctl restart catdex'
   ```

5. Verificar:
   ```bash
   curl -I https://catdex.nglab.es/  # 200 OK
   curl -s https://catdex.nglab.es/pb/api/catdex/health  # {"hooks":"ok",...}
   curl -sI https://catdex.nglab.es/favicon.ico  # 200 OK
   curl -sI https://catdex.nglab.es/sw.js  # 200 OK
   ```

## Configuración nginx dentro de CT 120

`/etc/nginx/sites-available/catdex` (dentro del CT 120) tiene una regla para servir
archivos estáticos directamente:

```nginx
location ~* ^/(manifest\.json|sw\.js|favicon\.(ico|png)|icon-.*|apple-touch.*|button\.png)$ {
    root /opt/catdex/public;   # ← IMPORTANTE: apunta al subdir public/, NO a /opt/catdex/
    try_files $uri =404;
    expires 1h;
}
```

Esta regla existe en el CT pero **no en el repo** (config operacional). Si alguien
re-deploya CT 120 desde cero o recrea la config nginx, debe acordarse de que
el `root` apunta a `/opt/catdex/public`. Si se queda en `/opt/catdex` los iconos
devolverán 404.

## Nota sobre `output: "standalone"`

Next 16 con `output: "standalone"` genera dos directorios:

- `.next/` — el output "normal" con `server/`, `static/`, manifests, etc.
- `.next/standalone/` — bundle self-contained con su propio `node_modules/`
  truncado (solo lo necesario para arrancar). Pensado para Docker.

Para nuestro deploy copiamos a CT 120:
- `.next/` → `/opt/catdex/.next/`
- `.next/standalone/server.js` → `/opt/catdex/server.js`
- `public/` → `/opt/catdex/public/`

El proceso `node /opt/catdex/server.js` funciona porque el `cwd` es `/opt/catdex/`,
donde están los tres directorios. NO es necesario copiar `.next/standalone/`
entero a `/opt/catdex/`.
