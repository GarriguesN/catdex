/**
 * PocketBase cron — daily streak-at-risk reminder.
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120
 */

// 19:00 UTC daily — a few hours of margin before the UTC-midnight streak
// cutoff used in scoring.pb.js, so there's still time left to capture.
cronAdd("streak-reminder", "0 19 * * *", () => {
  const today = new Date().toISOString().slice(0, 10);

  let atRisk = [];
  try {
    atRisk = $app.findRecordsByFilter(
      "users",
      "currentStreak > 0 && lastCaptureDate != {:today}",
      "",
      0,
      0,
      { today }
    );
  } catch (err) {
    console.error("[catdex:push-cron] lookup failed:", err);
    return;
  }

  const push = require(`${__hooks}/push-utils.js`);
  atRisk.forEach((u) => {
    const streak = u.get("currentStreak");
    push.sendPush(
      u.id,
      "🔥 Tu racha está en juego",
      `Llevas ${streak} día${streak !== 1 ? "s" : ""} seguidos — captura un gato hoy para no perderla.`,
      "/"
    );
  });
});
