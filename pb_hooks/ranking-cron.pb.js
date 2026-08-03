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
 *
 * Implementation note: NO top-level function/var/const declarations. goja
 * 0.23.x loads the file but throws cryptic 400s on routes from files that
 * declare them. The weekMondayKey logic is inlined below; the matching
 * client copy in lib/ranking.ts has unit tests. See health.pb.js header.
 */

// 00:05 UTC daily. Monday creates the new week's snapshot for every user;
// the rest of the week, the per-user findFirstRecordByFilter below finds
// an existing snapshot and short-circuits — so the daily overhead is one
// lookup per user, not one create.
cronAdd("weekly-snapshot", "5 0 * * *", () => {
  // Inline UTC-Monday key — matches lib/ranking.ts:weekMondayKey.
  // Duplicated to avoid a top-level function (goja JSVM limitation).
  const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const day = d.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  const weekKey = d.toISOString().slice(0, 10);

  let processed = 0;
  let errors = 0;

  let users = [];
  try {
    // No native "select all" — id is always non-empty, so this matches every row.
    users = $app.findRecordsByFilter("users", "id != ''", "", 0, 0, {});
  } catch (err) {
    console.error("[catdex:ranking-cron] user lookup failed:", err);
    require(`${__hooks}/cron-runs-utils.js`).recordCronRun("weekly-snapshot", 0, 1);
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
        processed += 1;
      } catch (err) {
        console.error("[catdex:ranking-cron] snapshot failed for user", u.id, err);
        errors += 1;
      }
    });
  });

  require(`${__hooks}/cron-runs-utils.js`).recordCronRun("weekly-snapshot", processed, errors);
});
