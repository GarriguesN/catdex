import { describe, it, expect, vi, beforeEach } from "vitest";

let mockMe = "me";
let mockDuels: any[] = [];

vi.mock("./pocketbase", () => ({
  getPocketBase: () => ({
    authStore: { record: { id: mockMe } },
    collection: () => ({
      getFullList: vi.fn().mockResolvedValue(mockDuels),
      create: vi.fn(),
      delete: vi.fn(),
    }),
  }),
}));

const { listMyDuels } = await import("./duels");

function duelRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "duel1",
    challenger: "me",
    opponent: "friend1",
    status: "active",
    endsAt: "2026-08-01T00:00:00Z",
    challengerStartScore: 100,
    opponentStartScore: 100,
    winnerSide: null,
    expand: {
      challenger: { id: "me", name: "Yo", avatar: "", score: 150 },
      opponent: { id: "friend1", name: "Ana", avatar: "", score: 120 },
    },
    ...overrides,
  };
}

describe("listMyDuels — perspective translation (challenger/opponent → me/them)", () => {
  beforeEach(() => {
    mockMe = "me";
    mockDuels = [];
  });

  it("shows me as the leader when I'm the challenger and gained more points", async () => {
    mockDuels = [duelRow()]; // me: 150-100=50, friend: 120-100=20
    const [entry] = await listMyDuels();
    expect(entry.myDelta).toBe(50);
    expect(entry.theirDelta).toBe(20);
    expect(entry.outcome).toBe("me");
    expect(entry.isChallenger).toBe(true);
    expect(entry.otherUser.id).toBe("friend1");
  });

  it("shows them as the leader when I'm the challenger but they gained more", async () => {
    mockDuels = [
      duelRow({
        expand: {
          challenger: { id: "me", name: "Yo", avatar: "", score: 110 }, // +10
          opponent: { id: "friend1", name: "Ana", avatar: "", score: 180 }, // +80
        },
      }),
    ];
    const [entry] = await listMyDuels();
    expect(entry.outcome).toBe("them");
  });

  // The tricky case: I'm the OPPONENT in the DB, not the challenger — the
  // perspective flip must still report correctly from "my" point of view.
  it("shows me as the leader when I'm the opponent and gained more points", async () => {
    mockMe = "friend1";
    mockDuels = [duelRow()]; // challenger(me-role="them")=150-100=50, opponent(me)=120-100=20
    const [entry] = await listMyDuels();
    expect(entry.isChallenger).toBe(false);
    expect(entry.myDelta).toBe(20);
    expect(entry.theirDelta).toBe(50);
    expect(entry.outcome).toBe("them");
    expect(entry.otherUser.id).toBe("me");
  });

  it("is a tie when both sides gained the same amount", async () => {
    mockDuels = [
      duelRow({
        expand: {
          challenger: { id: "me", name: "Yo", avatar: "", score: 130 },
          opponent: { id: "friend1", name: "Ana", avatar: "", score: 150 },
        },
        challengerStartScore: 100,
        opponentStartScore: 120, // both +30
      }),
    ];
    const [entry] = await listMyDuels();
    expect(entry.outcome).toBe("tie");
  });

  it("uses the server's stored winnerSide once finished, translated to me/them", async () => {
    mockDuels = [duelRow({ status: "finished", winnerSide: "opponent" })];
    const [entry] = await listMyDuels();
    // I'm the challenger; winnerSide="opponent" means the other person won.
    expect(entry.outcome).toBe("them");
  });

  it("translates a finished tie correctly regardless of role", async () => {
    mockMe = "friend1";
    mockDuels = [duelRow({ status: "finished", winnerSide: "tie" })];
    const [entry] = await listMyDuels();
    expect(entry.outcome).toBe("tie");
  });

  // Edge case: a snapshot/clock anomaly makes a start score look higher than
  // current — deltas must clamp to 0, not go negative or invert the outcome.
  it("clamps a negative delta to 0 instead of showing a negative gain", async () => {
    mockDuels = [
      duelRow({
        challengerStartScore: 500, // higher than current score below — shouldn't happen, but defensive
        expand: {
          challenger: { id: "me", name: "Yo", avatar: "", score: 150 },
          opponent: { id: "friend1", name: "Ana", avatar: "", score: 120 },
        },
        opponentStartScore: 100,
      }),
    ];
    const [entry] = await listMyDuels();
    expect(entry.myDelta).toBe(0);
    expect(entry.theirDelta).toBe(20);
    expect(entry.outcome).toBe("them");
  });

  it("returns an empty list when not authenticated", async () => {
    mockMe = ""; // authStore.record.id falsy → listMyDuels short-circuits
    const result = await listMyDuels();
    expect(result).toEqual([]);
  });

  // Fase 1.2 — finished duels must show frozen end-of-duel deltas, not
  // recompute against today's score (which would drift every time either
  // user captures another photo, weeks after the duel ended).
  it("uses frozen end scores for finished duels, ignoring later captures", async () => {
    mockDuels = [
      duelRow({
        status: "finished",
        winnerSide: "challenger",
        challengerStartScore: 100,
        opponentStartScore: 100,
        challengerEndScore: 140, // captured +40 before duel ended
        opponentEndScore: 110,   // captured +10 before duel ended
        // Today's live scores are higher — proves the client doesn't recompute.
        expand: {
          challenger: { id: "me", name: "Yo", avatar: "", score: 280 },
          opponent: { id: "friend1", name: "Ana", avatar: "", score: 250 },
        },
      }),
    ];
    const [entry] = await listMyDuels();
    expect(entry.myDelta).toBe(40);     // 140 - 100
    expect(entry.theirDelta).toBe(10);  // 110 - 100
    expect(entry.outcome).toBe("me");
  });

  it("falls back to current-score calc when finished duel has no frozen end scores", async () => {
    // Legacy row from before Fase 1.2: finished, winnerSide set, but no
    // challengerEndScore / opponentEndScore fields. The old behaviour must
    // still produce a sensible answer rather than NaN or zero.
    mockDuels = [
      duelRow({
        status: "finished",
        winnerSide: "challenger",
        challengerStartScore: 100,
        opponentStartScore: 100,
        // challengerEndScore and opponentEndScore intentionally absent
        expand: {
          challenger: { id: "me", name: "Yo", avatar: "", score: 150 },
          opponent: { id: "friend1", name: "Ana", avatar: "", score: 120 },
        },
      }),
    ];
    const [entry] = await listMyDuels();
    expect(entry.myDelta).toBe(50);  // 150 - 100
    expect(entry.theirDelta).toBe(20); // 120 - 100
  });

  // Fase 1.6 — client and server both clamp deltas to 0 (a duel measures
  // captures, not losses). When Fase 5.3 contracts let score decrease, we
  // still want the duel to read "you gained 0", not "you lost 50".
  it("clamps a negative live delta to 0 (Fase 1.6 cross-side contract)", async () => {
    // Active duel where current score is below the start score (e.g. user
    // spent points on a contract that hasn't shipped yet). Active duels
    // always use the live-score path, which already clamps.
    mockDuels = [
      duelRow({
        status: "active",
        challengerStartScore: 500,
        opponentStartScore: 100,
        expand: {
          challenger: { id: "me", name: "Yo", avatar: "", score: 200 }, // -300 → 0
          opponent: { id: "friend1", name: "Ana", avatar: "", score: 120 },
        },
      }),
    ];
    const [entry] = await listMyDuels();
    expect(entry.myDelta).toBe(0);    // clamped, not -300
    expect(entry.theirDelta).toBe(20); // 120 - 100
  });

  it("clamps a negative frozen delta to 0 in finished duels", async () => {
    // Same as above but for a finished duel: the frozen endScore is below
    // the startScore, so the delta must clamp to 0.
    mockDuels = [
      duelRow({
        status: "finished",
        winnerSide: "opponent", // opponent had a positive frozen delta
        challengerStartScore: 500,
        opponentStartScore: 100,
        challengerEndScore: 480, // -20 → clamp to 0
        opponentEndScore: 160,  // +60
        expand: {
          challenger: { id: "me", name: "Yo", avatar: "", score: 480 },
          opponent: { id: "friend1", name: "Ana", avatar: "", score: 200 },
        },
      }),
    ];
    const [entry] = await listMyDuels();
    expect(entry.myDelta).toBe(0);    // clamped, not -20
    expect(entry.theirDelta).toBe(60); // 160 - 100
    expect(entry.outcome).toBe("them"); // opponent won on the clamped values
  });
});
