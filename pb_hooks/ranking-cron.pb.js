/**
 * PocketBase cron — weekly score snapshot for the friends ranking (C.1).
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120
 *
 * lib/ranking.ts's weekMondayKey() computes the same UTC-Monday date key
 * client-side to look these up — keep both in sync if this schedule changes.
 *
 * Runs DAILY (not just Monday) since 2026-08-03 patch: if a Monday cron run
 * is missed (PocketBase down, deploy, restart race) the next 00:05 still
 * creates that week's snapshot. Idempotency via the per-user per-week
 * findFirstRecordByFilter below — only the first run each (user, weekKey)
 * does real work, the rest is a cheap lookup.
 */

// UTC-Monday key ("YYYY-MM-DD") matching lib/ranking.ts:weekMondayKey.
// Duplicated on purpose so the hook stays self-contained (no require/import
// in goja); the other copy is in lib/ranking.ts and has unit tests.
function weekMondayKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (day + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

// 00:05 UTC daily. Monday creates the new week's snapshot for every user;
// the rest of the week, the per-user findFirstRecordByFilter below finds
// an existing snapshot and short-circuits — so the daily overhead is one
// lookup per user, not one create.
cronAdd("weekly-snapshot", "5 0 * * *", () => {
  const weekKey = weekMondayKey(new Date());

  let users = [];
  try {
    // No native "select all" — id is always non-empty, so this matches every row.
    users = $app.findRecordsByFilter("users", "id != ''", "", 0, 0, {});
  } catch (err) {
    console.error("[catdex:ranking-cron] user lookup failed:", err);
    return;
  }

  $app.runInTransaction((txApp) => {
    users.forEach((u) => {
      try {
        const existing = txApp.findFirstRecordByFilter(
          "weekly_snapshots",
          "user = {:u} && weekKey = {:w}",
          { u: u.id, w: weekKey }
        );
        if (existing) return; // already snapshotted this week (Mon or any later day)
      } catch (_) {
        // not found — proceed to create
      }
      try {
        const collection = txApp.findCollectionByNameOrId("weekly_snapshots");
        const rec = new Record(collection);
        rec.set("user", u.id);
        rec.set("weekKey", weekKey);
        // ?? not || — if score is genuinely null on a legacy user, we want
        // the schema's default/0 to apply, not a coerced 0 (the || would also
        // coerce, but ?? makes intent obvious and matches JS best practice).
        rec.set("score", u.get("score") ?? 0);
        txApp.save(rec);
      } catch (err) {
        console.error("[catdex:ranking-cron] snapshot failed for user", u.id, err);
      }
    });
  });
});
