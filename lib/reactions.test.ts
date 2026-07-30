import { describe, it, expect, vi, beforeEach } from "vitest";
import { aggregateReactions, REACTION_EMOJIS } from "./reactions";

describe("aggregateReactions", () => {
  it("returns an empty array for no reactions", () => {
    expect(aggregateReactions([])).toEqual([]);
  });

  it("counts a single reaction", () => {
    expect(aggregateReactions([{ emoji: "🐾" }])).toEqual([{ emoji: "🐾", count: 1 }]);
  });

  it("sums repeated reactions of the same emoji", () => {
    const rows = [{ emoji: "❤️" }, { emoji: "❤️" }, { emoji: "❤️" }];
    expect(aggregateReactions(rows)).toEqual([{ emoji: "❤️", count: 3 }]);
  });

  it("counts multiple distinct emojis independently", () => {
    const rows = [{ emoji: "🐾" }, { emoji: "🐾" }, { emoji: "😻" }];
    const result = aggregateReactions(rows);
    expect(result).toContainEqual({ emoji: "🐾", count: 2 });
    expect(result).toContainEqual({ emoji: "😻", count: 1 });
    expect(result).toHaveLength(2);
  });

  it("always orders results by REACTION_EMOJIS order, not insertion order", () => {
    // 😂 is last in REACTION_EMOJIS but appears first in the input rows.
    const rows = [{ emoji: "😂" }, { emoji: "🐾" }];
    const result = aggregateReactions(rows);
    expect(result.map((r) => r.emoji)).toEqual(
      REACTION_EMOJIS.filter((e) => rows.some((r) => r.emoji === e))
    );
  });

  // Edge case: a legacy/unknown emoji value (e.g. a reaction type that was
  // later removed from REACTION_EMOJIS) must not produce a broken chip.
  it("silently drops an emoji that isn't in REACTION_EMOJIS", () => {
    const result = aggregateReactions([{ emoji: "🎉" }, { emoji: "🐾" }]);
    expect(result).toEqual([{ emoji: "🐾", count: 1 }]);
  });

  it("omits emojis with zero reactions rather than listing them at count 0", () => {
    const result = aggregateReactions([{ emoji: "🐾" }]);
    expect(result.some((r) => r.emoji === "❤️")).toBe(false);
  });
});

// PocketBase-coupled upsert logic — mocked so the "update vs create" branch
// is exercised without a live backend.
let mockMe = "me";
let mockExistingReaction: { id: string }[] = [];
const updateSpy = vi.fn();
const createSpy = vi.fn();
const deleteSpy = vi.fn();

vi.mock("./pocketbase", () => ({
  getPocketBase: () => ({
    authStore: { record: { id: mockMe } },
    collection: () => ({
      getFullList: vi.fn().mockResolvedValue(mockExistingReaction),
      update: updateSpy,
      create: createSpy,
      delete: deleteSpy,
    }),
  }),
}));

const { setMyReaction, removeMyReaction } = await import("./reactions");

describe("setMyReaction", () => {
  beforeEach(() => {
    mockMe = "me";
    mockExistingReaction = [];
    updateSpy.mockClear();
    createSpy.mockClear();
  });

  it("creates a new reaction when the user hasn't reacted to this photo yet", async () => {
    await setMyReaction("photo1", "🐾");
    expect(createSpy).toHaveBeenCalledWith({ photo: "photo1", user: "me", emoji: "🐾" });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("updates the existing row instead of creating a duplicate", async () => {
    mockExistingReaction = [{ id: "reaction1" }];
    await setMyReaction("photo1", "😻");
    expect(updateSpy).toHaveBeenCalledWith("reaction1", { emoji: "😻" });
    expect(createSpy).not.toHaveBeenCalled();
  });
});

describe("removeMyReaction", () => {
  beforeEach(() => {
    mockExistingReaction = [];
    deleteSpy.mockClear();
  });

  it("does nothing if there's no reaction to remove", async () => {
    await removeMyReaction("photo1");
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("deletes the existing reaction row", async () => {
    mockExistingReaction = [{ id: "reaction1" }];
    await removeMyReaction("photo1");
    expect(deleteSpy).toHaveBeenCalledWith("reaction1");
  });
});
