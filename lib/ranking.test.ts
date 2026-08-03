import { describe, it, expect, vi, beforeEach } from "vitest";
import { weekMondayKey, computeWeeklyDelta, computeDuelWinner, getWeeklyRanking } from "./ranking";

describe("weekMondayKey", () => {
  // 2024-01-01 is a known Monday — used as ground truth for every case below.
  it("returns the same date when given a Monday", () => {
    expect(weekMondayKey(new Date(Date.UTC(2024, 0, 1)))).toBe("2024-01-01");
  });

  it("returns the prior Monday for a mid-week date (Wednesday)", () => {
    expect(weekMondayKey(new Date(Date.UTC(2024, 0, 3)))).toBe("2024-01-01");
  });

  it("returns the prior Monday for a Sunday (end of the same week)", () => {
    expect(weekMondayKey(new Date(Date.UTC(2024, 0, 7)))).toBe("2024-01-01");
  });

  it("rolls over to the next week's Monday the day after Sunday", () => {
    expect(weekMondayKey(new Date(Date.UTC(2024, 0, 8)))).toBe("2024-01-08");
  });

  it("handles a year boundary correctly (Sunday Dec 31 belongs to the prior week)", () => {
    // 2023-12-31 was a Sunday; its Monday is 2023-12-25.
    expect(weekMondayKey(new Date(Date.UTC(2023, 11, 31)))).toBe("2023-12-25");
  });

  it("ignores the time-of-day component", () => {
    const morning = weekMondayKey(new Date(Date.UTC(2024, 0, 3, 0, 0, 1)));
    const night = weekMondayKey(new Date(Date.UTC(2024, 0, 3, 23, 59, 59)));
    expect(morning).toBe(night);
  });
});

describe("computeWeeklyDelta", () => {
  it("is the plain difference in the normal case", () => {
    expect(computeWeeklyDelta(150, 100)).toBe(50);
  });

  it("is 0 when the score hasn't changed since the snapshot", () => {
    expect(computeWeeklyDelta(100, 100)).toBe(0);
  });

  // Edge case: shouldn't happen (score never decreases) but a clock-skew or
  // out-of-order snapshot must not show a negative "you lost points" delta.
  it("clamps to 0 instead of going negative if the snapshot is somehow higher", () => {
    expect(computeWeeklyDelta(100, 150)).toBe(0);
  });

  it("treats a non-finite current score as 0", () => {
    expect(computeWeeklyDelta(NaN, 50)).toBe(0);
  });

  it("treats a non-finite snapshot score as 0 (falls back to the full current score)", () => {
    expect(computeWeeklyDelta(80, NaN)).toBe(80);
  });
});

describe("computeDuelWinner", () => {
  it("picks the challenger when they gained more points", () => {
    expect(computeDuelWinner(120, 80)).toBe("challenger");
  });

  it("picks the opponent when they gained more points", () => {
    expect(computeDuelWinner(40, 90)).toBe("opponent");
  });

  it("is a tie when both gained the same amount", () => {
    expect(computeDuelWinner(60, 60)).toBe("tie");
  });

  it("is a tie when neither gained anything", () => {
    expect(computeDuelWinner(0, 0)).toBe("tie");
  });
});

// getWeeklyRanking is PocketBase-coupled; mock its two dependencies so the
// merge/sort/fallback logic is exercised without a live backend.
vi.mock("./pocketbase", () => ({
  getPocketBase: () => ({
    authStore: {
      record: { id: "me", name: "Yo", avatar: "", score: 200 },
    },
    collection: () => ({
      getFullList: vi.fn().mockResolvedValue(mockSnapshots),
      // Fase 1.5 — getWeeklyRanking calls authRefresh() to pull a fresh
      // score for *me* before computing the deltas. Resolves with the
      // current authStore.record unchanged so tests are deterministic.
      authRefresh: vi.fn().mockResolvedValue(undefined),
    }),
  }),
}));
vi.mock("./friends", () => ({
  listFriends: () => Promise.resolve(mockFriends),
}));

let mockFriends: { friend: { id: string; name: string; avatar: string; score: number } }[] = [];
let mockSnapshots: { user: string; score: number }[] = [];

describe("getWeeklyRanking", () => {
  beforeEach(() => {
    mockFriends = [];
    mockSnapshots = [];
  });

  it("ranks me above a friend with a lower weekly delta", async () => {
    mockFriends = [{ friend: { id: "friend1", name: "Ana", avatar: "", score: 130 } }];
    mockSnapshots = [
      { user: "me", score: 100 }, // me: 200 - 100 = 100
      { user: "friend1", score: 120 }, // friend1: 130 - 120 = 10
    ];
    const result = await getWeeklyRanking();
    expect(result.map((r) => r.userId)).toEqual(["me", "friend1"]);
    expect(result[0].weeklyScore).toBe(100);
    expect(result[1].weeklyScore).toBe(10);
  });

  it("shows 0 for a friend with no snapshot yet, instead of throwing", async () => {
    mockFriends = [{ friend: { id: "friend2", name: "Luis", avatar: "", score: 500 } }];
    mockSnapshots = []; // no snapshot for anyone
    const result = await getWeeklyRanking();
    const luis = result.find((r) => r.userId === "friend2");
    expect(luis?.weeklyScore).toBe(0);
  });

  it("flags exactly one entry as isMe", async () => {
    mockFriends = [{ friend: { id: "friend3", name: "Eva", avatar: "", score: 10 } }];
    const result = await getWeeklyRanking();
    expect(result.filter((r) => r.isMe)).toHaveLength(1);
    expect(result.find((r) => r.isMe)?.userId).toBe("me");
  });

  it("returns just me when there are no friends", async () => {
    mockFriends = [];
    const result = await getWeeklyRanking();
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("me");
  });

  // Fase 1.5 — hasSnapshot distinguishes "0 earned this week" from
  // "no snapshot yet, ranking in preparation".
  it("marks hasSnapshot=true for users with a snapshot this week", async () => {
    mockFriends = [{ friend: { id: "friend4", name: "Sara", avatar: "", score: 60 } }];
    mockSnapshots = [
      { user: "me", score: 100 },     // me: 200 - 100 = 100
      { user: "friend4", score: 40 }, // friend4: 60 - 40 = 20
    ];
    const result = await getWeeklyRanking();
    expect(result.every((r) => r.hasSnapshot)).toBe(true);
  });

  it("marks hasSnapshot=false for users with no snapshot this week", async () => {
    mockFriends = [{ friend: { id: "friend5", name: "Tom", avatar: "", score: 30 } }];
    mockSnapshots = [{ user: "me", score: 100 }]; // only me has a snapshot
    const result = await getWeeklyRanking();
    const tom = result.find((r) => r.userId === "friend5");
    const me = result.find((r) => r.userId === "me");
    expect(tom?.hasSnapshot).toBe(false);
    expect(me?.hasSnapshot).toBe(true);
  });

  // Fase 1.5 — getWeeklyRanking accepts a cached friends list to skip the
  // internal listFriends() call. We verify this by spying on the mock.
  it("does not call listFriends when a cached friends list is provided", async () => {
    const friendsSpy = vi.fn().mockResolvedValue([]);
    // Re-mock friends module for this single test
    vi.doMock("./friends", () => ({ listFriends: friendsSpy }));
    const { getWeeklyRanking: freshGet } = await import("./ranking");
    await freshGet([{ friendshipId: "f1", friend: { id: "friend6", name: "Luz", avatar: "", score: 0 } }]);
    expect(friendsSpy).not.toHaveBeenCalled();
  });
});
