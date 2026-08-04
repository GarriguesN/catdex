import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { areSoundsEnabled, setSoundsEnabled } from "./sound-prefs";

describe("sound-prefs", () => {
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

  it("defaults to true when nothing is stored", () => {
    expect(areSoundsEnabled()).toBe(true);
  });

  it("returns true when enabled", () => {
    setSoundsEnabled(true);
    expect(areSoundsEnabled()).toBe(true);
  });

  it("returns false when disabled", () => {
    setSoundsEnabled(false);
    expect(areSoundsEnabled()).toBe(false);
  });

  it("returns true when window is undefined (SSR)", () => {
    const originalWindow = globalThis.window;
    // @ts-ignore
    delete globalThis.window;
    expect(areSoundsEnabled()).toBe(true);
    globalThis.window = originalWindow;
  });
});
