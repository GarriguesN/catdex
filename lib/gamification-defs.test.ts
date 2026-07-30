import { describe, it, expect } from "vitest";
import {
  rankForScore,
  rarityForDiscovererCount,
  highestRarity,
  RARITY_FRAME_CLASS,
} from "./gamification-defs";

describe("rankForScore", () => {
  it("returns Novato at score 0", () => {
    expect(rankForScore(0).key).toBe("novice");
  });

  it("stays Novato just below the Cazador threshold", () => {
    expect(rankForScore(99).key).toBe("novice");
  });

  it("promotes to Cazador exactly at its threshold (inclusive boundary)", () => {
    expect(rankForScore(100).key).toBe("hunter");
  });

  it("stays Cazador just below Guardián", () => {
    expect(rankForScore(499).key).toBe("hunter");
  });

  it("promotes to Guardián exactly at its threshold", () => {
    expect(rankForScore(500).key).toBe("guardian");
  });

  it("promotes to Leyenda Callejera exactly at its threshold", () => {
    expect(rankForScore(2000).key).toBe("legend");
  });

  it("stays Leyenda for arbitrarily large scores", () => {
    expect(rankForScore(1_000_000).key).toBe("legend");
  });

  // Edge cases: data that should never occur in practice (negative/NaN score)
  // must still resolve to a valid tier instead of throwing/returning undefined.
  it("falls back to the lowest tier for a negative score", () => {
    expect(rankForScore(-50).key).toBe("novice");
  });

  it("falls back to the lowest tier for NaN", () => {
    expect(rankForScore(NaN).key).toBe("novice");
  });
});

describe("rarityForDiscovererCount", () => {
  it("is 'own' for a single discoverer", () => {
    expect(rarityForDiscovererCount(1).key).toBe("own");
  });

  it("is 'shared' for exactly two discoverers", () => {
    expect(rarityForDiscovererCount(2).key).toBe("shared");
  });

  it("is 'legendary' for three discoverers (the documented threshold)", () => {
    expect(rarityForDiscovererCount(3).key).toBe("legendary");
  });

  it("stays 'legendary' well past the threshold", () => {
    expect(rarityForDiscovererCount(50).key).toBe("legendary");
  });

  // Edge case: 0 shouldn't occur (a cat always has at least its own
  // discoverer's photo) but must degrade gracefully, not throw.
  it("treats 0 as 'own' rather than throwing", () => {
    expect(rarityForDiscovererCount(0).key).toBe("own");
  });
});

describe("highestRarity", () => {
  const defs = {
    common_badge: { rarity: "Común" },
    rare_badge: { rarity: "Raro" },
    epic_badge: { rarity: "Épico" },
    legendary_badge: { rarity: "Legendario" },
  };

  it("returns null for an empty badge list", () => {
    expect(highestRarity([], defs)).toBeNull();
  });

  it("picks the single rarity when only one badge is unlocked", () => {
    expect(highestRarity(["rare_badge"], defs)).toBe("Raro");
  });

  it("picks the highest rarity among several unlocked badges, any order", () => {
    expect(highestRarity(["common_badge", "legendary_badge", "rare_badge"], defs)).toBe("Legendario");
    expect(highestRarity(["legendary_badge", "common_badge"], defs)).toBe("Legendario");
  });

  it("ignores an unknown badge code instead of crashing", () => {
    expect(highestRarity(["not_a_real_badge"], defs)).toBeNull();
  });

  it("ignores unknown codes mixed with real ones", () => {
    expect(highestRarity(["not_a_real_badge", "epic_badge"], defs)).toBe("Épico");
  });
});

describe("RARITY_FRAME_CLASS", () => {
  it("has no entry for Común (no ring shown for the common tier)", () => {
    expect(RARITY_FRAME_CLASS["Común"]).toBeUndefined();
  });

  it("has a distinct class for every non-common rarity", () => {
    expect(RARITY_FRAME_CLASS["Raro"]).toBeTruthy();
    expect(RARITY_FRAME_CLASS["Épico"]).toBeTruthy();
    expect(RARITY_FRAME_CLASS["Legendario"]).toBeTruthy();
    const values = ["Raro", "Épico", "Legendario"].map((k) => RARITY_FRAME_CLASS[k]);
    expect(new Set(values).size).toBe(3);
  });
});
