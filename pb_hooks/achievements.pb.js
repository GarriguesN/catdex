/**
 * PocketBase hooks — server-side achievement persistence.
 * Writes to the `achievements` collection (create/update rules are null, so
 * only hooks with $app privileges can write) on every new photo or cat.
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120 (with achievements-utils.js)
 */

// ═══ onRecordAfterCreateSuccess for photos ═══
onRecordAfterCreateSuccess((e) => {
  try {
    require(`${__hooks}/achievements-utils.js`).syncAchievements(e.record.get("user"));
  } catch (err) {
    console.error("[catdex:achievements] photos hook error:", err);
  }
  e.next();
}, "photos");

// ═══ onRecordAfterCreateSuccess for cats ═══
onRecordAfterCreateSuccess((e) => {
  try {
    require(`${__hooks}/achievements-utils.js`).syncAchievements(e.record.get("discoveredBy"));
  } catch (err) {
    console.error("[catdex:achievements] cats hook error:", err);
  }
  e.next();
}, "cats");
