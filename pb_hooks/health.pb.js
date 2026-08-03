/**
 * Health check — answers GET /api/catdex/health with the loaded hooks
 * version and current server time. Bump `version` in every deploy so a
 * curl from the browser or a deployment script can confirm which build
 * is actually live (PocketBase keeps the JSVM in memory and only reloads
 * when a .pb.js file changes on disk — see journalctl "File ... changed,
 * restarting..."). Replaces indirect deduces ("does duels create return
 * a useful error?") with a single curl (Fase 0.1).
 */

const HEALTH_VERSION = "2026-08-03-0.1";

routerAdd("GET", "/api/catdex/health", (e) => {
  return e.json(200, {
    hooks: "ok",
    version: HEALTH_VERSION,
    now: new Date().toISOString(),
  });
});
