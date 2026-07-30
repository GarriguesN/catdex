import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  nextColonyMilestone,
  highestMilestoneReached,
  getLastCelebratedMilestone,
  setLastCelebratedMilestone,
  COLONY_MILESTONES,
} from "./colony";

describe("nextColonyMilestone", () => {
  it("returns the first milestone when the total is 0", () => {
    expect(nextColonyMilestone(0)).toBe(100);
  });

  it("returns the same milestone just below its threshold", () => {
    expect(nextColonyMilestone(99)).toBe(100);
  });

  // Boundary: exactly at a milestone should point to the NEXT one, not itself.
  it("moves to the next milestone once the current one is reached exactly", () => {
    expect(nextColonyMilestone(100)).toBe(250);
  });

  it("works across an arbitrary middle milestone", () => {
    expect(nextColonyMilestone(600)).toBe(1000);
  });

  it("returns null once every milestone has been passed", () => {
    expect(nextColonyMilestone(COLONY_MILESTONES[COLONY_MILESTONES.length - 1])).toBeNull();
    expect(nextColonyMilestone(999_999)).toBeNull();
  });

  it("treats a non-finite total as 0", () => {
    expect(nextColonyMilestone(NaN)).toBe(100);
  });
});

describe("highestMilestoneReached", () => {
  it("is null below the first milestone", () => {
    expect(highestMilestoneReached(0)).toBeNull();
    expect(highestMilestoneReached(99)).toBeNull();
  });

  it("is exactly the milestone when the total matches it precisely", () => {
    expect(highestMilestoneReached(100)).toBe(100);
  });

  it("is the highest one reached when the total is between two milestones", () => {
    expect(highestMilestoneReached(300)).toBe(250);
  });

  it("is the last milestone for totals beyond it", () => {
    expect(highestMilestoneReached(999_999)).toBe(COLONY_MILESTONES[COLONY_MILESTONES.length - 1]);
  });

  it("treats a negative total as 0 (null result)", () => {
    expect(highestMilestoneReached(-10)).toBeNull();
  });
});

describe("celebrated milestone persistence", () => {
  // Node 26's own experimental `localStorage` global can shadow jsdom's and
  // behaves inconsistently without --localstorage-file — stub a plain
  // in-memory implementation instead of depending on either.
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  it("defaults to 0 when nothing has been celebrated yet", () => {
    expect(getLastCelebratedMilestone()).toBe(0);
  });

  it("remembers the last celebrated milestone", () => {
    setLastCelebratedMilestone(250);
    expect(getLastCelebratedMilestone()).toBe(250);
  });

  it("overwrites the previous value on a later celebration", () => {
    setLastCelebratedMilestone(100);
    setLastCelebratedMilestone(500);
    expect(getLastCelebratedMilestone()).toBe(500);
  });

  // Edge case: corrupted/non-numeric localStorage value shouldn't crash the
  // milestone check, just fall back to "nothing celebrated".
  it("falls back to 0 for a corrupted stored value", () => {
    localStorage.setItem("catdex_colony_celebrated_milestone", "not-a-number");
    expect(getLastCelebratedMilestone()).toBe(0);
  });
});
