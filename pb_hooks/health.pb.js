/**
 * Health check — answers GET /api/catdex/health with the loaded hooks
 * version and current server time. Bump the version string in every
 * deploy so a curl from the browser or a deployment script can confirm
 * which build is actually live (PocketBase keeps the JSVM in memory and
 * only reloads when a .pb.js file changes on disk — see journalctl
 * "File ... changed, restarting..."). Replaces indirect deduces
 * ("does duels create return a useful error?") with a single curl.
 *
 * Implementation note: this file declares NO top-level variables because
 * PocketBase's JSVM (goja) returns a cryptic 400 "Something went wrong"
 * when a .pb.js hook file has top-level var/const/let declarations (in
 * this build, 0.23.x). All literals are inline in the callback. This
 * was diagnosed 2026-08-03 by writing a minimal diag endpoint and
 * observing it worked only without variables.
 */

routerAdd("GET", "/api/catdex/health", (e) => {
  return e.json(200, {
    hooks: "ok",
    version: "2026-08-03-0.1",
    now: new Date().toISOString(),
  });
});
