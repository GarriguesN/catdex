/**
 * PocketBase hook — reactions integrity.
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120
 */

// ═══ onRecordCreateRequest / onRecordUpdateRequest for reactions ═══
// `user` is always forced from the auth token — never trust the client's
// value (same pattern as duels.pb.js's challenger, shares.pb.js's sharedBy).
onRecordCreateRequest((e) => {
  e.record.set("user", e.auth.id);
  e.next();
}, "reactions");

onRecordUpdateRequest((e) => {
  if (e.record.get("user") !== e.record.original().get("user")) {
    throw new BadRequestError("No se puede cambiar el autor de una reacción.");
  }
  e.next();
}, "reactions");
