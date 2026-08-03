/**
 * Duels — 1-on-1 friend challenges over 7 days (Fase C.1). Creation/closing
 * validation lives server-side in pb_hooks/duels.pb.js; this is just the
 * client CRUD + a live "who's ahead" preview using the same comparison
 * logic as the server (computeDuelWinner, from lib/ranking.ts).
 */

import { getPocketBase } from "./pocketbase";
import { computeDuelWinner } from "./ranking";
import type { FriendUser } from "./friends";

export interface DuelEntry {
  id: string;
  otherUser: FriendUser;
  isChallenger: boolean;
  status: "active" | "finished";
  endsAt: string;
  myDelta: number;
  theirDelta: number;
  /** Live preview while active (from current scores), final result once finished — always from "my" point of view, not the DB's challenger/opponent roles. */
  outcome: "me" | "them" | "tie";
}

function toUser(rec: Record<string, unknown> | undefined): FriendUser {
  const r = (rec || {}) as Record<string, unknown>;
  return {
    id: (r.id as string) || "",
    name: (r.name as string) || "",
    avatar: (r.avatar as string) || "",
    score: (r.score as number) || 0,
  };
}

export async function listMyDuels(): Promise<DuelEntry[]> {
  const pb = getPocketBase();
  const me = pb.authStore.record?.id;
  if (!me) return [];

  const rows = await pb.collection("duels").getFullList({
    filter: `challenger="${me}" || opponent="${me}"`,
    expand: "challenger,opponent",
    sort: "-created",
    $autoCancel: false, // see lib/friends.ts:79 — useRefetchOnFocus can fire
                        // while this query is in flight, causing PB to cancel
                        // and the .catch to swallow an empty duels section.
  });

  return rows.map((r: any) => {
    const isChallenger = r.challenger === me;
    const challengerUser = toUser(r.expand?.challenger);
    const opponentUser = toUser(r.expand?.opponent);
    // For finished duels the server has frozen challengerEndScore /
    // opponentEndScore at the moment of closing — use those so the numbers
    // don't drift every time either side captures a new photo (Fase 1.2).
    // For active duels (or legacy finished rows without the end scores),
    // fall back to current-score-minus-start-score.
    const useFrozen = r.status === "finished" && r.challengerEndScore != null && r.opponentEndScore != null;
    const myFrozen = useFrozen
      ? (isChallenger ? r.challengerEndScore : r.opponentEndScore) - (isChallenger ? r.challengerStartScore : r.opponentStartScore)
      : null;
    const theirFrozen = useFrozen
      ? (isChallenger ? r.opponentEndScore : r.challengerEndScore) - (isChallenger ? r.opponentStartScore : r.challengerStartScore)
      : null;
    const myDelta = myFrozen ?? Math.max(0, (isChallenger ? challengerUser.score ?? 0 : opponentUser.score ?? 0) - (isChallenger ? r.challengerStartScore : r.opponentStartScore));
    const theirDelta = theirFrozen ?? Math.max(0, (isChallenger ? opponentUser.score ?? 0 : challengerUser.score ?? 0) - (isChallenger ? r.opponentStartScore : r.challengerStartScore));

    let outcome: "me" | "them" | "tie";
    if (r.status === "finished" && r.winnerSide) {
      // The DB stores the winner as challenger/opponent — translate to "me"/"them".
      outcome = r.winnerSide === "tie" ? "tie" : (r.winnerSide === "challenger") === isChallenger ? "me" : "them";
    } else {
      const preview = computeDuelWinner(myDelta, theirDelta); // arg1=me, arg2=them here
      outcome = preview === "tie" ? "tie" : preview === "challenger" ? "me" : "them";
    }

    return {
      id: r.id,
      otherUser: isChallenger ? opponentUser : challengerUser,
      isChallenger,
      status: r.status,
      endsAt: r.endsAt,
      myDelta,
      theirDelta,
      outcome,
    };
  });
}

export async function createDuel(opponentId: string): Promise<void> {
  const pb = getPocketBase();
  await pb.collection("duels").create({ opponent: opponentId });
}

export async function cancelDuel(duelId: string): Promise<void> {
  await getPocketBase().collection("duels").delete(duelId);
}
