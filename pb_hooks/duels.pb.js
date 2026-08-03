/**
 * PocketBase hooks — 1-on-1 duels between friends (Fase C.1).
 * Deploy: copy to /opt/pocketbase/pb_hooks/ on CT 120, together with
 * push-utils.js.
 */

const DUEL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// ═══ onRecordCreateRequest for duels ═══
// challenger is forced from the auth token (never trust the client's
// value); opponent must be an accepted friend with no other active duel
// against the same pair. Start scores are captured here so the closing
// cron only needs today's score to compute each side's delta.
onRecordCreateRequest((e) => {
  const challenger = e.auth.id;
  e.record.set("challenger", challenger);
  const opponent = e.record.get("opponent");

  if (!opponent || opponent === challenger) {
    throw new BadRequestError("Elige un amigo distinto de ti mismo.");
  }

  let friendship = null;
  try {
    // findFirstRecordByFilter with relation fields has inconsistent behavior
    // across PocketBase versions — use findRecordsByFilter + manual check.
    const rows = $app.findRecordsByFilter(
      "friendships",
      "status = 'accepted'",
      "",
      0,
      0,
      {}
    );
    for (const row of rows) {
      const req = row.getString("requester");
      const addr = row.getString("addressee");
      if ((req === challenger && addr === opponent) || (req === opponent && addr === challenger)) {
        friendship = row;
        break;
      }
    }
  } catch (_) {
    // not found — falls through
  }
  if (!friendship) {
    throw new BadRequestError("Solo puedes retar a amigos aceptados.");
  }

  let existingActive = null;
  try {
    const rows = $app.findRecordsByFilter(
      "duels",
      "status = 'active'",
      "",
      0,
      0,
      {}
    );
    for (const row of rows) {
      const ch = row.getString("challenger");
      const op = row.getString("opponent");
      if ((ch === challenger && op === opponent) || (ch === opponent && op === challenger)) {
        existingActive = row;
        break;
      }
    }
  } catch (_) {
    // none — ok
  }
  if (existingActive) {
    throw new BadRequestError("Ya tenéis un duelo activo.");
  }

  const challengerRec = $app.findRecordById("users", challenger);
  const opponentRec = $app.findRecordById("users", opponent);

  e.record.set("status", "active");
  e.record.set("challengerStartScore", challengerRec.get("score") || 0);
  e.record.set("opponentStartScore", opponentRec.get("score") || 0);
  e.record.set("endsAt", new Date(Date.now() + DUEL_DURATION_MS).toISOString());

  e.next();
}, "duels");

// ═══ New duel → notify the opponent ═══
onRecordAfterCreateSuccess((e) => {
  try {
    const challenger = $app.findRecordById("users", e.record.get("challenger"));
    require(`${__hooks}/push-utils.js`).sendPush(
      e.record.get("opponent"),
      "¡Nuevo duelo!",
      `${challenger ? challenger.get("name") || "Un amigo" : "Un amigo"} te ha retado a un duelo de 7 días en CatDex.`,
      "/friends"
    );
  } catch (err) {
    console.error("[catdex:duels] notify failed:", err);
  }
  e.next();
}, "duels");

// ═══ Duel cancelled (delete only allowed while status='active' since Fase 1.3)
// → notify the other side. e.record in AfterDelete still carries the deleted
// row's fields, which is what we need — there's no other way to know who
// the opponent was once the row is gone. ═══
onRecordAfterDeleteSuccess((e) => {
  try {
    const challengerId = e.record.get("challenger");
    const opponentId = e.record.get("opponent");
    const cancellerId = e.auth.id;
    // Canceller is the other party — don't tell them they cancelled their own duel.
    const recipientId = cancellerId === challengerId ? opponentId : challengerId;
    if (!recipientId || recipientId === cancellerId) {
      e.next();
      return;
    }
    const canceller = $app.findRecordById("users", cancellerId);
    const cancellerName = canceller ? canceller.get("name") || "Tu rival" : "Tu rival";
    require(`${__hooks}/push-utils.js`).sendPush(
      recipientId,
      "Duelo cancelado",
      `${cancellerName} ha cancelado vuestro duelo.`,
      "/friends"
    );
  } catch (err) {
    console.error("[catdex:duels] cancel notify failed:", err);
  }
  e.next();
}, "duels");

// ═══ Daily cron — close duels past their endsAt ═══
cronAdd("close-duels", "30 0 * * *", () => {
  const now = new Date().toISOString();

  let due = [];
  try {
    due = $app.findRecordsByFilter("duels", "status = 'active' && endsAt <= {:now}", "", 0, 0, { now });
  } catch (err) {
    console.error("[catdex:duels-cron] lookup failed:", err);
    return;
  }

  const push = require(`${__hooks}/push-utils.js`);
  due.forEach((duel) => {
    try {
      const challenger = $app.findRecordById("users", duel.get("challenger"));
      const opponent = $app.findRecordById("users", duel.get("opponent"));
      const challengerScore = challenger.get("score") || 0;
      const opponentScore = opponent.get("score") || 0;
      const challengerDelta = challengerScore - duel.get("challengerStartScore");
      const opponentDelta = opponentScore - duel.get("opponentStartScore");
      const winnerSide =
        challengerDelta > opponentDelta ? "challenger" : opponentDelta > challengerDelta ? "opponent" : "tie";

      // Freeze end scores so the client can show "Tú +40 · Ana +10"
      // without those numbers drifting every time either user captures
      // another photo (Fase 1.2). Without this, a duel that closed
      // three weeks ago keeps recomputing deltas against today's score.
      duel.set("challengerEndScore", challengerScore);
      duel.set("opponentEndScore", opponentScore);
      duel.set("status", "finished");
      duel.set("winnerSide", winnerSide);
      $app.save(duel);

      const resultText =
        winnerSide === "tie"
          ? "¡Habéis empatado!"
          : `Ganó ${winnerSide === "challenger" ? challenger.get("name") || "el retador" : opponent.get("name") || "el retado"}.`;
      push.sendPush(duel.get("challenger"), "Duelo terminado", resultText, "/friends");
      push.sendPush(duel.get("opponent"), "Duelo terminado", resultText, "/friends");
    } catch (err) {
      console.error("[catdex:duels-cron] failed to close duel", duel.id, err);
    }
  });
});
