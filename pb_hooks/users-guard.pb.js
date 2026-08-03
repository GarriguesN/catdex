/**
 * Guard hook — users.onRecordUpdateRequest protects game-critical fields
 * from being modified directly by the authenticated user. Without this
 * guard, updateRule: '@request.auth.id = id' lets any logged-in user
 * PATCH their own users record with `{score: 99999}` from the browser
 * console and bypass the scoring server-side logic entirely.
 *
 * Blocked fields (must only be written by hooks like scoring.pb.js,
 * achievements-utils.js, the future contracts/cron hooks, etc.):
 *   - score, photoCount, currentStreak, bestStreak, lastCaptureDate
 *
 * Implementation note (PocketBase 0.23.x): inside onRecordUpdateRequest,
 * e.record already carries the MERGED values — the new ones from the
 * client have already replaced the old. To detect what the user is trying
 * to change, we re-read the original from the DB and compare.
 *
 * Superusers bypass the check (admin UI needs to fix bad data).
 * Internal txApp.save() in scoring.pb.js etc. does NOT fire this hook
 * (it's HTTP-only), so game logic is unaffected.
 */
onRecordUpdateRequest((e) => {
  if (e.auth.isSuperuser()) {
    e.next();
    return;
  }

  var protectedFields = ["score", "photoCount", "currentStreak", "bestStreak", "lastCaptureDate"];

  var original;
  try {
    original = $app.findRecordById("users", e.record.id);
  } catch (err) {
    throw new BadRequestError("users-guard: no se pudo leer el registro original: " + String(err));
  }

  for (var i = 0; i < protectedFields.length; i++) {
    var field = protectedFields[i];
    var oldVal = original.get(field);
    var newVal = e.record.get(field);
    if (oldVal !== newVal) {
      throw new BadRequestError(
        "El campo '" + field + "' solo puede ser modificado por el servidor. " +
        "Si crees que falta algo, abre un issue en github.com/GarriguesN/catdex."
      );
    }
  }

  e.next();
}, "users");
