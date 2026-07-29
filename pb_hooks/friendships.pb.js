/**
 * PocketBase hooks — friendships integrity.
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120
 */

// ═══ onRecordCreateRequest for friendships ═══
// Rejects duplicate/crossed requests (same pair in any order) and forces
// every new friendship to start as "pending" — the API rules alone can't
// stop a requester from creating an already-accepted row.
onRecordCreateRequest((e) => {
  const requester = e.record.get("requester");
  const addressee = e.record.get("addressee");

  if (requester === addressee) {
    throw new BadRequestError("No puedes añadirte a ti mismo.");
  }

  let existing = null;
  try {
    existing = $app.findFirstRecordByFilter(
      "friendships",
      "(requester = {:a} && addressee = {:b}) || (requester = {:b} && addressee = {:a})",
      { a: requester, b: addressee }
    );
  } catch (_) {
    // no match — ok
  }
  if (existing) {
    throw new BadRequestError("Ya existe una solicitud o amistad entre estos usuarios.");
  }

  e.record.set("status", "pending");
  e.next();
}, "friendships");

// ═══ onRecordUpdateRequest for friendships ═══
// The only legal update is the addressee flipping pending → accepted;
// requester/addressee are immutable once created.
onRecordUpdateRequest((e) => {
  const original = e.record.original();
  if (
    e.record.get("requester") !== original.get("requester") ||
    e.record.get("addressee") !== original.get("addressee")
  ) {
    throw new BadRequestError("No se pueden cambiar los usuarios de una amistad.");
  }
  if (original.get("status") === "accepted" && e.record.get("status") !== "accepted") {
    throw new BadRequestError("Una amistad aceptada solo se puede eliminar.");
  }
  e.next();
}, "friendships");
