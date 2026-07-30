import { describe, it, expect, vi, beforeEach } from "vitest";
import { findMatchingOwner, SHARED_DISCOVERY_THRESHOLD } from "./shared-discovery";

// Distances below are exact (hamming distance in bits between two 64-bit
// hex hashes), computed by construction so the expected similarity % is
// known ahead of time rather than asserted against itself.
const BASE = "0000000000000000"; // 64 zero bits
const DIST_1 = "0000000000000001"; // differs by 1 bit → sim ≈ 98.4%
const DIST_6 = "000000000000003f"; // differs by 6 bits → sim ≈ 90.6% (>= threshold)
const DIST_7 = "000000000000007f"; // differs by 7 bits → sim ≈ 89.1% (< threshold)

describe("findMatchingOwner", () => {
  it("returns null when there are no candidates", () => {
    expect(findMatchingOwner(BASE, [])).toBeNull();
  });

  it("returns null when the target hash is empty", () => {
    expect(findMatchingOwner("", [{ hash: BASE, ownerId: "a" }])).toBeNull();
  });

  it("matches an identical hash", () => {
    expect(findMatchingOwner(BASE, [{ hash: BASE, ownerId: "a" }])).toBe("a");
  });

  it("matches a near-identical hash comfortably above the threshold", () => {
    expect(findMatchingOwner(BASE, [{ hash: DIST_1, ownerId: "a" }])).toBe("a");
  });

  // Boundary: SHARED_DISCOVERY_THRESHOLD is 90 — 6 bits of difference (90.6%)
  // should match, 7 bits (89.1%) should not.
  it("matches right at the threshold boundary (6-bit difference, ~90.6%)", () => {
    expect(findMatchingOwner(BASE, [{ hash: DIST_6, ownerId: "a" }])).toBe("a");
  });

  it("does not match just below the threshold (7-bit difference, ~89.1%)", () => {
    expect(findMatchingOwner(BASE, [{ hash: DIST_7, ownerId: "a" }])).toBeNull();
  });

  it("skips a candidate with a missing/empty hash instead of throwing", () => {
    expect(findMatchingOwner(BASE, [{ hash: "", ownerId: "a" }, { hash: BASE, ownerId: "b" }])).toBe("b");
  });

  it("returns the first matching candidate in array order", () => {
    const result = findMatchingOwner(BASE, [
      { hash: DIST_7, ownerId: "no-match" },
      { hash: BASE, ownerId: "first-match" },
      { hash: DIST_1, ownerId: "second-match" },
    ]);
    expect(result).toBe("first-match");
  });

  it("uses exactly 90 as the documented threshold constant", () => {
    expect(SHARED_DISCOVERY_THRESHOLD).toBe(90);
  });
});

// findSharedDiscoverer is PocketBase-coupled — mock its two dependencies.
let mockFriends: { friend: { id: string; name: string; avatar: string; score: number } }[] = [];
let mockCats: { hash: string; discoveredBy: string }[] = [];

vi.mock("./pocketbase", () => ({
  getPocketBase: () => ({
    collection: () => ({ getFullList: vi.fn().mockResolvedValue(mockCats) }),
  }),
}));
vi.mock("./friends", () => ({
  listFriends: () => Promise.resolve(mockFriends),
}));

const { findSharedDiscoverer } = await import("./shared-discovery");

describe("findSharedDiscoverer", () => {
  beforeEach(() => {
    mockFriends = [];
    mockCats = [];
  });

  it("returns null when the user has no friends", async () => {
    const result = await findSharedDiscoverer(BASE, "me");
    expect(result).toBeNull();
  });

  it("returns null when no target hash is given", async () => {
    mockFriends = [{ friend: { id: "friend1", name: "Ana", avatar: "", score: 0 } }];
    const result = await findSharedDiscoverer("", "me");
    expect(result).toBeNull();
  });

  it("returns the friend whose cat matches", async () => {
    mockFriends = [{ friend: { id: "friend1", name: "Ana", avatar: "", score: 0 } }];
    mockCats = [{ hash: BASE, discoveredBy: "friend1" }];
    const result = await findSharedDiscoverer(BASE, "me");
    expect(result?.id).toBe("friend1");
  });

  it("returns null when no friend's cat matches", async () => {
    mockFriends = [{ friend: { id: "friend1", name: "Ana", avatar: "", score: 0 } }];
    mockCats = [{ hash: DIST_7, discoveredBy: "friend1" }];
    const result = await findSharedDiscoverer(BASE, "me");
    expect(result).toBeNull();
  });
});
