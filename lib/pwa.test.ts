import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { isIOS, isAndroid, isStandalonePWA } from "./pwa";

describe("pwa utilities", () => {
  let originalWindow: any;

  beforeEach(() => {
    // Save original window to restore later if modified
    originalWindow = global.window;

    // Clear mocks
    vi.restoreAllMocks();

    // Setup navigator mock if it exists
    if (typeof window !== "undefined") {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: '', standalone: undefined },
        configurable: true,
        writable: true
      });

      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockImplementation(query => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
        configurable: true,
        writable: true
      });
    }
  });

  afterEach(() => {
    // Restore window
    if (originalWindow !== global.window) {
      global.window = originalWindow;
    }
  });

  describe("isIOS", () => {
    it("should return true for iPhone", () => {
      window.navigator.userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1";
      expect(isIOS()).toBe(true);
    });

    it("should return true for iPad", () => {
      window.navigator.userAgent = "Mozilla/5.0 (iPad; CPU OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1";
      expect(isIOS()).toBe(true);
    });

    it("should return true for iPod", () => {
      window.navigator.userAgent = "Mozilla/5.0 (iPod touch; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1";
      expect(isIOS()).toBe(true);
    });

    it("should return false for Android", () => {
      window.navigator.userAgent = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36";
      expect(isIOS()).toBe(false);
    });

    it("should return false for Desktop Windows", () => {
      window.navigator.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36";
      expect(isIOS()).toBe(false);
    });
  });

  describe("isAndroid", () => {
    it("should return true for Android mobile", () => {
      window.navigator.userAgent = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36";
      expect(isAndroid()).toBe(true);
    });

    it("should return true for Android tablet", () => {
      window.navigator.userAgent = "Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Safari/537.36";
      expect(isAndroid()).toBe(true);
    });

    it("should return false for iOS", () => {
      window.navigator.userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1";
      expect(isAndroid()).toBe(false);
    });

    it("should return false for Desktop Mac", () => {
      window.navigator.userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36";
      expect(isAndroid()).toBe(false);
    });
  });

  describe("isStandalonePWA", () => {
    it("should return false when window is undefined", () => {
      // @ts-ignore
      delete global.window;
      expect(typeof window).toBe("undefined");
      expect(isStandalonePWA()).toBe(false);
    });

    it("should return true when display-mode is standalone", () => {
      window.matchMedia = vi.fn().mockImplementation((query) => {
        return {
          matches: query === "(display-mode: standalone)",
        };
      });
      expect(isStandalonePWA()).toBe(true);
      expect(window.matchMedia).toHaveBeenCalledWith("(display-mode: standalone)");
    });

    it("should return true when navigator.standalone is true (iOS fallback)", () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false }));
      (window.navigator as any).standalone = true;
      expect(isStandalonePWA()).toBe(true);
    });

    it("should return false when not standalone and navigator.standalone is false", () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false }));
      (window.navigator as any).standalone = false;
      expect(isStandalonePWA()).toBe(false);
    });

    it("should return false when matchMedia is false and navigator.standalone is undefined", () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false }));
      (window.navigator as any).standalone = undefined;
      expect(isStandalonePWA()).toBe(false);
    });
  });
});
