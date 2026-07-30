/**
 * PocketBase cron — weekly score snapshot for the friends ranking (C.1).
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120
 *
 * lib/ranking.ts's weekMondayKey() computes the same UTC-Monday date key
 * client-side to look these up — keep both in sync if this schedule changes.
 */

// 00:05 UTC every Monday — a few minutes after the UTC-midnight week
// boundary used by weekMondayKey(), so "today" here IS the new week's key.
cronAdd("weekly-snapshot", "5 0 * * 1", () => {
  const weekKey = new Date().toISOString().slice(0, 10);

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
        if (existing) return; // already snapshotted this week (e.g. cron re-run after a restart)
      } catch (_) {
        // not found — proceed to create
      }
      try {
        const collection = txApp.findCollectionByNameOrId("weekly_snapshots");
        const rec = new Record(collection);
        rec.set("user", u.id);
        rec.set("weekKey", weekKey);
        rec.set("score", u.get("score") || 0);
        txApp.save(rec);
      } catch (err) {
        console.error("[catdex:ranking-cron] snapshot failed for user", u.id, err);
      }
    });
  });
});
