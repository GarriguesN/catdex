/**
 * PocketBase hook — scoring + photoCount + streak server-side.
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120
 */

// "Day" boundary for streaks is UTC midnight (server-local, same
// approximation already accepted for night_owl/early_bird in
// achievements-utils.js) — not per-user timezone.
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

// ═══ onRecordAfterCreateSuccess for photos ═══
onRecordAfterCreateSuccess((e) => {
  const photo = e.record;
  const photoCat = photo.get("cat");
  const photoUser = photo.get("user");

  if (photoCat && photoUser) {
    try {
      // Single writer at a time: read-modify-write cat.photoCount + user.score
      // inside a transaction so two concurrent uploads to the same cat can't
      // race and lose an increment. Must use txApp (not $app) for every
      // find/save in here — see PocketBase JSVM docs on runInTransaction.
      $app.runInTransaction((txApp) => {
        const cat = txApp.findRecordById("cats", photoCat);
        if (!cat) return;

        const isFirstPhoto = (cat.get("photoCount") || 0) === 0;
        const points = isFirstPhoto ? 50 : 10;

        // Update cat photoCount
        cat.set("photoCount", (cat.get("photoCount") || 0) + 1);
        txApp.save(cat);

        // Award points to user
        const user = txApp.findRecordById("users", photoUser);
        if (user) {
          user.set("score", (user.get("score") || 0) + points);

          // Streak: same day as last capture = unchanged, next day = +1,
          // any gap = reset to 1.
          const today = todayStr();
          const lastDate = user.get("lastCaptureDate") || "";
          if (lastDate !== today) {
            const streak = lastDate === yesterdayStr() ? (user.get("currentStreak") || 0) + 1 : 1;
            user.set("currentStreak", streak);
            user.set("lastCaptureDate", today);
          }

          txApp.save(user);
        }
      });
    } catch (err) {
      console.error("[catdex:hook] error:", err);
    }
  }
  // Without e.next() the hook chain stops here and the achievements
  // handler (achievements.pb.js, same event) never runs.
  e.next();
}, "photos");

// ═══ onRecordAfterDeleteSuccess for photos ═══
onRecordAfterDeleteSuccess((e) => {
  const photo = e.record;
  const photoCat = photo.get("cat");

  if (photoCat) {
    try {
      $app.runInTransaction((txApp) => {
        const cat = txApp.findRecordById("cats", photoCat);
        if (cat) {
          cat.set("photoCount", Math.max(0, (cat.get("photoCount") || 0) - 1));
          txApp.save(cat);
        }
      });
    } catch (err) {
      console.error("[catdex:hook] delete error:", err);
    }
  }
  e.next();
}, "photos");
