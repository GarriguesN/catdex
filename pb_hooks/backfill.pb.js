/**
 * One-shot backfill — grants the achievements users already earned before
 * the server-side evaluator existed (v1.4.1+). Triggered via HTTP (admin
 * only), guarded by an app_state flag; safe to re-run (syncAchievements is
 * idempotent — it only ever inserts missing rows).
 *
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120, restart pocketbase,
 * then call with a superuser token:
 *   curl -H "Authorization: <superuser-token>" \
 *        https://catdex.nglab.es/pb/api/catdex/backfill-achievements
 */
routerAdd("GET", "/api/catdex/backfill-achievements", (c) => {
  // Guarded by the internal shared secret (PUSH_INTERNAL_SECRET, already set
  // on the pocketbase systemd unit) so random visitors can't trigger it.
  const secret = $os.getenv("PUSH_INTERNAL_SECRET") || "";
  if (!secret || c.request.header.get("X-Internal-Secret") !== secret) {
    return c.json(403, { ok: false, error: "forbidden" });
  }

  try {
    // findRecordsByFilter (not findFirstRecordByFilter — that one throws a
    // GoError when no row matches, which would abort the whole run).
    const flags = $app.findRecordsByFilter("app_state", "key = {:k}", "", 1, 0, { k: "backfill:v1" });
    if (flags.length > 0) {
      return c.json(200, { ok: true, skipped: true, note: "already ran" });
    }

    const users = $app.findRecordsByFilter("users", "", "", 0, 0);
    let done = 0;
    for (const u of users) {
      try {
        require(`${__hooks}/achievements-utils.js`).syncAchievements(u.id);
        done++;
      } catch (err) {
        console.error("[catdex:backfill] user " + u.id + ":", err);
      }
    }

    const col = $app.findCollectionByNameOrId("app_state");
    const rec = new Record(col);
    rec.set("key", "backfill:v1");
    rec.set("value", String(done));
    $app.save(rec);

    console.log(`[catdex:backfill] done: ${done}/${users.length} users synced`);
    return c.json(200, { ok: true, done, total: users.length });
  } catch (err) {
    console.error("[catdex:backfill] error:", err);
    return c.json(500, { ok: false, error: String(err) });
  }
});
