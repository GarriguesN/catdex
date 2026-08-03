/**
 * Shared achievement evaluation — require()d from achievements.pb.js handlers
 * (not auto-loaded: only *.pb.js files are executed by PocketBase).
 *
 * Recomputes the user's earned badges from live data and persists any new
 * ones. All badges defined in lib/achievements-defs.ts are evaluated here.
 */

// WMO weather codes (Open-Meteo) used by the weather achievements.
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

/**
 * Europe/Madrid UTC offset in minutes for a given date (CEST +120 from the
 * last Sunday of March to the last Sunday of October, CET +60 otherwise).
 * Fallback for photos captured before tzOffsetMin existed.
 */
function esOffset(d) {
  const lastSunday = (year, month) => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    return new Date(Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay()));
  };
  const start = lastSunday(d.getUTCFullYear(), 2);
  const end = lastSunday(d.getUTCFullYear(), 9);
  return d >= start && d < end ? 120 : 60;
}

/**
 * Minutes to add to a photo's UTC timestamp to get the capturer's local
 * time. The capture flow stores the device's offset at capture time
 * (which follows GPS/network timezone automatically). Old photos lack it
 * (PocketBase number fields store 0 instead of null) — 0 means "no data",
 * so they fall back to Europe/Madrid.
 */
function tzOffsetMinFor(rec) {
  const off = rec.get("tzOffsetMin");
  if (typeof off === "number" && off !== 0 && Number.isFinite(off)) return off;
  return esOffset(new Date(rec.getString("created").replace(" ", "T")));
}

/**
 * Photos captured after the v1.4.2 capture flow (which always sends a real
 * device offset — ±60/±120 in Spain). Legacy rows carry tzOffsetMin=0, so
 * their weatherCode/tempC are the field-default 0 and must be ignored.
 */
function hasCaptureMetadata(p) {
  const off = p.get("tzOffsetMin");
  return typeof off === "number" && off !== 0;
}

function localDay(ts, offMin) {
  return new Date(ts + offMin * 60000).toISOString().slice(0, 10);
}

module.exports = {
  esOffset,
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
      if (photos.length >= 250) earned.push("photographer_500");
      if (cats.some((c) => c.get("manuallyNamed"))) earned.push("namer");
      if (cats.some((c) => c.get("notes"))) earned.push("notekeeper");

      // 3+ cats discovered on the same LOCAL day (per-photo device offset,
      // first photo of each cat decides its day).
      const dayCount = new Map();
      cats.forEach((c) => {
        const firstPhoto = photos
          .filter((p) => p.get("cat") === c.id)
          .sort((a, b) => (a.getString("created") < b.getString("created") ? -1 : 1))[0];
        const off = firstPhoto ? tzOffsetMinFor(firstPhoto) : esOffset(new Date());
        const day = localDay(new Date(c.getString("created").replace(" ", "T")).getTime(), off);
        dayCount.set(day, (dayCount.get(day) || 0) + 1);
      });
      if ([...dayCount.values()].some((n) => n >= 3)) earned.push("lucky_day");

      // A single cat photographed 5/30+ times (photoCount maintained by scoring.pb.js).
      if (cats.some((c) => (c.get("photoCount") || 0) >= 5)) earned.push("loyal_5");
      if (cats.some((c) => (c.get("photoCount") || 0) >= 30)) earned.push("loyal_50");

      // Local-time hours — each photo uses the device offset captured with
      // it (falls back to Europe/Madrid for pre-v1.4.2 photos).
      const localHours = photos.map(
        (p) => new Date(new Date(p.getString("created").replace(" ", "T")).getTime() + tzOffsetMinFor(p) * 60000).getUTCHours()
      );
      if (localHours.some((h) => h >= 22 || h < 5)) earned.push("night_owl");
      if (localHours.some((h) => h >= 5 && h < 8)) earned.push("early_bird");

      // Zones = ~1.1 km grid cell (lat+lng rounded to 2 decimals). Both axes
      // matter: two photos on the same latitude but 100 km apart are NOT the
      // same zone.
      const areas = new Set();
      photos.forEach((p) => {
        const lat = p.get("lat");
        const lng = p.get("lng");
        if (lat != null && lng != null) areas.add(`${lat.toFixed(2)}|${lng.toFixed(2)}`);
      });
      if (areas.size >= 3) earned.push("explorer_3");
      if (areas.size >= 10) earned.push("explorer_10");

      // Weather achievements — real WMO codes + temperature stored at capture
      // (only for photos with capture metadata; legacy rows have the
      // field-default 0 and must not count). rainy_day also honors a note
      // mentioning rain, for older captures.
      const metered = photos.filter(hasCaptureMetadata);
      const hasRain = metered.some((p) => RAIN_CODES.has(p.get("weatherCode")));
      const hasSnow = metered.some((p) => SNOW_CODES.has(p.get("weatherCode")));
      const temps = metered.map((p) => p.get("tempC")).filter((t) => typeof t === "number");
      const maxTemp = temps.length ? Math.max(...temps) : -Infinity;
      const minTemp = temps.length ? Math.min(...temps) : Infinity;
      if (hasRain || cats.some((c) => c.get("notes") && /lluvia|lloviendo|rain/i.test(c.get("notes")))) {
        earned.push("rainy_day");
      }
      if (hasSnow) earned.push("snowy_day");
      if (maxTemp >= 35) earned.push("heat_wave");
      if (minTemp <= 0) earned.push("cold_snap");

      // Streak fields live on `users` (maintained by scoring.pb.js, which
      // runs before this hook on the same "photos" create event).
      const user = txApp.findRecordById("users", userId);
      const currentStreak = (user && user.get("currentStreak")) || 0;
      if (currentStreak >= 7) earned.push("streak_7");
      if (currentStreak >= 30) earned.push("streak_30");

      // First share link created (shares rows are written by shares.pb.js).
      const share = txApp.findRecordsByFilter("shares", "sharedBy = {:u}", "", 1, 0, { u: userId });
      if (share.length >= 1) earned.push("share_first");

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
