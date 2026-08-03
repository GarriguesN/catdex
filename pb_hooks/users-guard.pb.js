/**
 * Guard hook — users.onRecordUpdateRequest protects game-critical fields
 * from being modified directly by the authenticated user. Without this
 * guard, updateRule: '@request.auth.id = id' lets any logged-in user
 * PATCH their own users record with `{score: 99999}` from the browser
 * console and bypass the scoring server-side logic entirely.
 *
 * Blocked fields (must only be written by hooks like scoring.pb.js,
 * achievements-utils.js, the future contracts/cron hooks, etc.):
 *   - score
 *   - photoCount
 *   - currentStreak
 *   - bestStreak
 *   - lastCaptureDate
 *
 * Allowed fields (user-editable via /profile/edit, etc.):
 *   - name, avatar, emailVisibility, inviteCode, verified (admin-only),
 *     and any future profile-only fields the product adds.
 *
 * Superusers are exempt (they need to be able to fix bad data via admin UI).
 */
onRecordUpdateRequest((e) => {
  // Superusers can update anything.
  if (e.auth.isSuperuser()) {
    e.next();
    return;
  }

  const protectedFields = [
    "score",
    "photoCount",
    "currentStreak",
    "bestStreak",
    "lastCaptureDate",
  ];

  // e.requestInfo().body is the parsed JSON the client is trying to set.
  // For each protected field, if the new value differs from the current
  // record value, reject the update with a precise error.
  const body = e.requestInfo().body || {};
  for (const field of protectedFields) {
    if (!(field in body)) continue; // field not in payload — not being updated
    const current = e.record.get(field);
    const incoming = body[field];
    // Compare as numbers (PocketBase returns 0 for unset number fields, not
    // null, so a strict !== works for "0 vs 0" and "10 vs 10").
    if (current !== incoming) {
      throw new BadRequestError(
        "El campo '" + field + "' solo puede ser modificado por el servidor. " +
        "Si crees que falta algo, abre un bug en https://github.com/GarriguesN/catdex/issues"
      );
    }
  }

  e.next();
}, "users");
