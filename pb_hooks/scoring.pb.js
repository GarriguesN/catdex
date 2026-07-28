/**
 * PocketBase hook — scoring + photoCount server-side.
 *
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120
 * PocketBase auto-loads *.pb.js files from pb_hooks/ on start.
 */

// ═══ onRecordAfterCreateSuccess for photos ═══
onRecordAfterCreateSuccess((e) => {
  const photo = e.record; // the new photo record
  const photoCat = photo.get("cat");
  const photoUser = photo.get("user");

  if (!photoCat || !photoUser) return;

  // Check if this is a NEW cat (first photo = discovery) or existing
  $app.dao().db()
    .newQuery("SELECT photoCount, discoveredBy FROM cats WHERE id = {:catId}")
    .bind({ catId: photoCat })
    .one()
    .then((cat) => {
      if (!cat) return;

      const isFirstPhoto = cat.photoCount === 0;
      const points = isFirstPhoto ? 50 : 10;

      // Update cat photoCount atomically
      $app.dao().db()
        .newQuery("UPDATE cats SET photoCount = photoCount + 1 WHERE id = {:catId}")
        .bind({ catId: photoCat })
        .execute();

      // Award points to user (server-side, cannot be tampered with)
      $app.dao().db()
        .newQuery("UPDATE users SET score = COALESCE(score, 0) + {:pts} WHERE id = {:userId}")
        .bind({ pts: points, userId: photoUser })
        .execute();
    })
    .catch((err) => {
      console.error("[catdex:hook] score update failed:", err);
    });
}, "photos");

// ═══ onRecordAfterDeleteSuccess for photos ═══
onRecordAfterDeleteSuccess((e) => {
  const photo = e.record;
  const photoCat = photo.get("cat");

  if (!photoCat) return;

  // Decrement photoCount
  $app.dao().db()
    .newQuery("UPDATE cats SET photoCount = MAX(0, photoCount - 1) WHERE id = {:catId}")
    .bind({ catId: photoCat })
    .execute();
}, "photos");
