/**
 * Shared achievement evaluation — require()d from achievements.pb.js handlers
 * (not auto-loaded: only *.pb.js files are executed by PocketBase).
 *
 * Recomputes the user's earned badges from live data and persists any new
 * ones. All badges defined in lib/achievements-defs.ts are evaluated here.
 */

module.exports = {
  /** Recomputes the user's earned badges and persists any new ones. */
  syncAchievements(userId) {
    if (!userId) return;

    // Reads + writes share one transaction so a concurrent photo/cat create
    // for the same user can't race and drop a badge unlock — see txApp note
    // in scoring.pb.js.
    $app.runInTransaction((txApp) => {
      const cats = txApp.findRecordsByFilter("cats", "discoveredBy = {:u}", "", 0, 0, { u: userId });
      const photos = txApp.findRecordsByFilter("photos", "user = {:u}", "", 0, 0, { u: userId });

      const earned = [];
      if (cats.length >= 1) earned.push("first_catch");
      if (cats.length >= 10) earned.push("collector_10");
      if (cats.length >= 25) earned.push("collector_25");
      if (photos.length >= 50) earned.push("photographer_50");
      if (photos.length >= 500) earned.push("photographer_500");
      if (cats.some((c) => c.get("manuallyNamed"))) earned.push("namer");
      if (cats.some((c) => c.get("notes"))) earned.push("notekeeper");

      // 3+ cats discovered on the same server-local day.
      const dayCount = new Map();
      cats.forEach((c) => {
        const day = new Date(c.getString("created").replace(" ", "T")).toDateString();
        dayCount.set(day, (dayCount.get(day) || 0) + 1);
      });
      if ([...dayCount.values()].some((n) => n >= 3)) earned.push("lucky_day");

      // A single cat photographed 5/50+ times (photoCount maintained by scoring.pb.js).
      if (cats.some((c) => (c.get("photoCount") || 0) >= 5)) earned.push("loyal_5");
      if (cats.some((c) => (c.get("photoCount") || 0) >= 50)) earned.push("loyal_50");

      // A cat note mentioning rain.
      if (cats.some((c) => c.get("notes") && /lluvia|lloviendo|rain/i.test(c.get("notes")))) {
        earned.push("rainy_day");
      }

      // First share link created (shares rows are written by shares.pb.js).
      const share = txApp.findRecordsByFilter("shares", "sharedBy = {:u}", "", 1, 0, { u: userId });
      if (share.length >= 1) earned.push("share_first");

      // Server-local hours (UTC on the deployed instance) — a photo taken at
      // 23:30 CEST counts as 21:30. Acceptable drift for a fun badge.
      const hours = photos.map((p) => new Date(p.getString("created").replace(" ", "T")).getHours());
      if (hours.some((h) => h >= 22 || h < 5)) earned.push("night_owl");
      if (hours.some((h) => h >= 5 && h < 8)) earned.push("early_bird");

      const areas = new Set();
      photos.forEach((p) => {
        const lat = p.get("lat");
        if (lat) areas.add(lat.toFixed(2));
      });
      if (areas.size >= 3) earned.push("explorer_3");
      if (areas.size >= 10) earned.push("explorer_10");

      // Streak fields live on `users` (maintained by scoring.pb.js, which
      // runs before this hook on the same "photos" create event).
      const user = txApp.findRecordById("users", userId);
      const currentStreak = (user && user.get("currentStreak")) || 0;
      if (currentStreak >= 7) earned.push("streak_7");
      if (currentStreak >= 30) earned.push("streak_30");

      const existing = new Set(
        txApp
          .findRecordsByFilter("achievements", "user = {:u}", "", 0, 0, { u: userId })
          .map((r) => r.get("badgeCode"))
      );

      const collection = txApp.findCollectionByNameOrId("achievements");
      earned.forEach((badgeCode) => {
        if (existing.has(badgeCode)) return;
        const rec = new Record(collection);
        rec.set("user", userId);
        rec.set("badgeCode", badgeCode);
        rec.set("unlockedAt", new Date().getTime());
        txApp.save(rec);
      });
    });
  },
};
