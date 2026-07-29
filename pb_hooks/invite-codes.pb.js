/**
 * PocketBase hooks — invite codes for the friends system.
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120
 */

// ═══ onRecordAfterCreateSuccess for users ═══
// Generates a unique short code for every new user — covers both email and
// OAuth signups. 8 chars, base32-ish alphabet without ambiguous glyphs.
onRecordAfterCreateSuccess((e) => {
  const user = e.record;
  if (!user.get("inviteCode")) {
    const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = $security.randomStringWithAlphabet(8, alphabet);
      let taken = null;
      try {
        taken = $app.findFirstRecordByFilter("users", "inviteCode = {:code}", { code });
      } catch (_) {
        // free — ok
      }
      if (!taken) {
        user.set("inviteCode", code);
        $app.save(user);
        break;
      }
    }
  }
  e.next();
}, "users");

// ═══ POST /api/catdex/resolve-invite ═══
// Resolves an invite code to { id, name, avatar } — never the email — so the
// users collection list/view rules can stay closed.
routerAdd(
  "POST",
  "/api/catdex/resolve-invite",
  (e) => {
    const body = e.requestInfo().body || {};
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) {
      throw new BadRequestError("Falta el código.");
    }

    let owner = null;
    try {
      owner = $app.findFirstRecordByFilter("users", "inviteCode = {:code}", { code });
    } catch (_) {
      // not found — fall through to the generic 404 below
    }
    if (!owner) {
      throw new NotFoundError("Código no válido.");
    }

    return e.json(200, {
      id: owner.id,
      name: owner.get("name"),
      avatar: owner.get("avatar"),
    });
  },
  $apis.requireAuth()
);
