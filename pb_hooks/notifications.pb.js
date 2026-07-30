/**
 * PocketBase hooks — writes to the `notifications` collection so the bell
 * icon in /profile has a single source to count/list from instead of
 * recomputing from friendships/shares ad-hoc on the client, AND fires a real
 * Web Push (best-effort — a user with no subscription just gets the in-app
 * row) so these reach a closed app too. Deploy: copy to
 * /opt/pocketbase/pb_hooks/ on CT 120, together with push-utils.js.
 */

function notify(userId, type, refId, pushTitle, pushBody, pushUrl) {
  try {
    const collection = $app.findCollectionByNameOrId("notifications");
    const rec = new Record(collection);
    rec.set("user", userId);
    rec.set("type", type);
    rec.set("refId", refId || "");
    rec.set("read", false);
    $app.save(rec);
  } catch (err) {
    console.error("[catdex:notifications] failed to write:", err);
  }

  if (pushTitle) {
    require(`${__hooks}/push-utils.js`).sendPush(userId, pushTitle, pushBody, pushUrl);
  }
}

// ═══ New friend request → notify the addressee ═══
onRecordAfterCreateSuccess((e) => {
  if (e.record.get("status") === "pending") {
    const addressee = e.record.get("addressee");
    const requester = $app.findRecordById("users", e.record.get("requester"));
    notify(
      addressee,
      "friend_request",
      e.record.id,
      "Nueva solicitud de amistad",
      `${requester ? requester.get("name") || "Alguien" : "Alguien"} quiere ser tu amigo en CatDex.`,
      "/friends"
    );
  }
  e.next();
}, "friendships");

// ═══ New share → notify the sharer's accepted friends ═══
// refId is the cat id (not the share id) — friends already have access to
// that cat's own page (/cat?id=...), no need to resolve the shares
// collection (whose rules only allow the sharer to read their own rows).
onRecordAfterCreateSuccess((e) => {
  const sharedBy = e.record.get("sharedBy");
  const catId = e.record.get("cat");
  if (!sharedBy || !catId) {
    e.next();
    return;
  }

  try {
    const sharer = $app.findRecordById("users", sharedBy);
    const cat = $app.findRecordById("cats", catId);
    const friendships = $app.findRecordsByFilter(
      "friendships",
      "status = 'accepted' && (requester = {:u} || addressee = {:u})",
      "",
      0,
      0,
      { u: sharedBy }
    );
    friendships.forEach((f) => {
      const requester = f.get("requester");
      const friendId = requester === sharedBy ? f.get("addressee") : requester;
      notify(
        friendId,
        "share",
        catId,
        "Nueva captura compartida",
        `${sharer ? sharer.get("name") || "Un amigo" : "Un amigo"} compartió ${cat ? `"${cat.get("name")}"` : "un gato"} contigo.`,
        `/cat?id=${catId}`
      );
    });
  } catch (err) {
    console.error("[catdex:notifications] share fan-out failed:", err);
  }
  e.next();
}, "shares");
