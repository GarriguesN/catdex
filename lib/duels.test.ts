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
});
