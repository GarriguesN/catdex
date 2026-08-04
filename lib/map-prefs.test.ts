import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { isShowFriendsEnabled, setShowFriendsEnabled } from "./map-prefs";

describe("map-prefs", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("isShowFriendsEnabled", () => {
    it("returns false when window is undefined", () => {
      vi.stubGlobal("window", undefined);
      expect(isShowFriendsEnabled()).toBe(false);
    });

    it("returns false when localStorage has no value", () => {
      vi.stubGlobal("window", {});
      expect(isShowFriendsEnabled()).toBe(false);
    });

    it("returns false when localStorage has '0'", () => {
      vi.stubGlobal("window", {});
      localStorage.setItem("catdex_map_show_friends", "0");
      expect(isShowFriendsEnabled()).toBe(false);
    });

    it("returns true when localStorage has '1'", () => {
      vi.stubGlobal("window", {});
      localStorage.setItem("catdex_map_show_friends", "1");
      expect(isShowFriendsEnabled()).toBe(true);
    });
  });

  describe("setShowFriendsEnabled", () => {
    it("sets '1' in localStorage when passed true", () => {
      setShowFriendsEnabled(true);
      expect(localStorage.getItem("catdex_map_show_friends")).toBe("1");
    });

    it("sets '0' in localStorage when passed false", () => {
      setShowFriendsEnabled(false);
      expect(localStorage.getItem("catdex_map_show_friends")).toBe("0");
    });
  });
});
