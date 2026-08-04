import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { getCurrentPosition, isGeolocationAvailable, formatCoords, reverseGeocode } from "./geo";

describe("geo helpers", () => {
  let originalNavigator: any;

  beforeEach(() => {
    originalNavigator = global.navigator;
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe("getCurrentPosition", () => {
    it("rejects if navigator.geolocation is undefined", async () => {
      Object.defineProperty(global, "navigator", {
        value: { ...originalNavigator, geolocation: undefined },
        writable: true,
        configurable: true,
      });

      await expect(getCurrentPosition()).rejects.toThrow("Geolocation not available");
    });

    it("resolves with position on success", async () => {
      const mockPos = { coords: { latitude: 10, longitude: 20 } };
      Object.defineProperty(global, "navigator", {
        value: {
          ...originalNavigator,
          geolocation: {
            getCurrentPosition: (success: any) => success(mockPos),
          },
        },
        writable: true,
        configurable: true,
      });

      const res = await getCurrentPosition();
      expect(res).toEqual(mockPos);
    });

    it("rejects on getCurrentPosition error", async () => {
      const mockError = new Error("Permission denied");
      Object.defineProperty(global, "navigator", {
        value: {
          ...originalNavigator,
          geolocation: {
            getCurrentPosition: (success: any, error: any) => error(mockError),
          },
        },
        writable: true,
        configurable: true,
      });

      await expect(getCurrentPosition()).rejects.toThrow("Permission denied");
    });
  });

  describe("isGeolocationAvailable", () => {
    it("returns true when available", () => {
      Object.defineProperty(global, "navigator", {
        value: { ...originalNavigator, geolocation: {} },
        writable: true,
        configurable: true,
      });
      expect(isGeolocationAvailable()).toBe(true);
    });

    it("returns false when not available", () => {
      Object.defineProperty(global, "navigator", {
        value: { ...originalNavigator, geolocation: undefined },
        writable: true,
        configurable: true,
      });
      expect(isGeolocationAvailable()).toBe(false);
    });
  });

  describe("formatCoords", () => {
    it("rounds coordinates correctly", () => {
      const result = formatCoords(10.123456, 20.654321);
      expect(result.lat).toBe(10.1235);
      expect(result.lng).toBe(20.6543);
    });
  });

  describe("reverseGeocode", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("returns empty string on fetch failure", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network Error"));
      expect(await reverseGeocode(10, 20)).toBe("");
    });

    it("returns empty string on non-ok response", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false });
      expect(await reverseGeocode(10, 20)).toBe("");
    });

    it("returns city from address data", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: { city: "Springfield" } }),
      });
      expect(await reverseGeocode(10, 20)).toBe("Springfield");
    });

    it("returns town if city is not available", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: { town: "Shelbyville" } }),
      });
      expect(await reverseGeocode(10, 20)).toBe("Shelbyville");
    });
  });
});
