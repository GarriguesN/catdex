/**
 * PocketBase hook — scoring + photoCount server-side.
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120
 */

// ═══ onRecordAfterCreateSuccess for photos ═══
onRecordAfterCreateSuccess((e) => {
  const photo = e.record;
  const photoCat = photo.get("cat");
  const photoUser = photo.get("user");

  if (!photoCat || !photoUser) return;

  try {
    const cat = $app.findRecordById("cats", photoCat);
    if (!cat) return;

    const isFirstPhoto = (cat.get("photoCount") || 0) === 0;
    const points = isFirstPhoto ? 50 : 10;

    // Update cat photoCount
    cat.set("photoCount", (cat.get("photoCount") || 0) + 1);
    $app.save(cat);

    // Award points to user
    const user = $app.findRecordById("users", photoUser);
    if (user) {
      user.set("score", (user.get("score") || 0) + points);
      $app.save(user);
    }
  } catch (err) {
    console.error("[catdex:hook] error:", err);
  }
  // Without e.next() the hook chain stops here and the achievements
  // handler (achievements.pb.js, same event) never runs.
  e.next();
}, "photos");

// ═══ onRecordAfterDeleteSuccess for photos ═══
onRecordAfterDeleteSuccess((e) => {
  const photo = e.record;
  const photoCat = photo.get("cat");
  if (!photoCat) return;

  try {
    const cat = $app.findRecordById("cats", photoCat);
    if (cat) {
      cat.set("photoCount", Math.max(0, (cat.get("photoCount") || 0) - 1));
      $app.save(cat);
    }
  } catch (err) {
    console.error("[catdex:hook] delete error:", err);
  }
  e.next();
}, "photos");
