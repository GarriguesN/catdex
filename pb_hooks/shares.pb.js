/**
 * PocketBase hooks — sharing a cat's card, in-app and via a public link.
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120
 */

// ═══ onRecordCreateRequest for shares ═══
// Only the discoverer of a cat can share it, and the token is generated
// server-side (never trust a client-supplied token). Ownership is checked
// here rather than in the collection's createRule to avoid relying on
// relation back-reference filter syntax, which is version-sensitive.
onRecordCreateRequest((e) => {
  e.record.set("sharedBy", e.auth.id);

  const catId = e.record.get("cat");
  let cat = null;
  try {
    cat = $app.findRecordById("cats", catId);
  } catch (_) {
    // not found — falls through to the check below
  }
  if (!cat || cat.get("discoveredBy") !== e.auth.id) {
    throw new BadRequestError("Solo puedes compartir gatos que hayas descubierto tú.");
  }

  const alphabet = "abcdefghjkmnpqrstvwxyz23456789";
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = $security.randomStringWithAlphabet(10, alphabet);
    let taken = null;
    try {
      taken = $app.findFirstRecordByFilter("shares", "token = {:t}", { t: token });
    } catch (_) {
      // free — ok
    }
    if (!taken) {
      e.record.set("token", token);
      break;
    }
  }
  if (!e.record.get("token")) {
    throw new BadRequestError("No se ha podido generar el enlace, inténtalo de nuevo.");
  }

  e.next();
}, "shares");

// ═══ GET /api/catdex/shared/{token} ═══
// Public, no auth — the only unauthenticated surface in the app. Returns
// only the fields listed below, never email/score/other cats.
routerAdd("GET", "/api/catdex/shared/{token}", (e) => {
  const token = e.request.pathValue("token");
  if (!token) {
    throw new NotFoundError("Enlace no válido.");
  }

  let share = null;
  try {
    share = $app.findFirstRecordByFilter("shares", "token = {:t}", { t: token });
  } catch (_) {
    // not found — falls through
  }
  if (!share) {
    throw new NotFoundError("Enlace no válido o caducado.");
  }

  const cat = $app.findRecordById("cats", share.get("cat"));
  const sharer = $app.findRecordById("users", share.get("sharedBy"));
  const photos = $app.findRecordsByFilter(
    "photos",
    "cat = {:cat}",
    "created",
    1,
    0,
    { cat: cat.id }
  );
  const photo = photos[0];

  // Relative id/filename only — the client already knows its own PocketBase
  // base URL and builds the /api/files/... URL itself (avoids depending on
  // an uncertain "app URL" setting on the server side).
  return e.json(200, {
    catName: cat.get("name"),
    photoId: photo ? photo.id : null,
    photoFilename: photo ? photo.get("thumb") || photo.get("photo") : null,
    discovererName: sharer ? sharer.get("name") : "",
    capturedAt: photo ? photo.get("created") : cat.get("created"),
  });
});
