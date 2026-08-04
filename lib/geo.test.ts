import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCurrentPosition, isGeolocationAvailable, formatCoords, reverseGeocode } from "./geo";

describe("geo helpers", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe("getCurrentPosition", () => {
    it("should reject when navigator.geolocation is not available", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      await expect(getCurrentPosition()).rejects.toThrow("Geolocation not available");
    });

    it("should resolve with position when available", async () => {
      const mockPosition = { coords: { latitude: 10, longitude: 20 } };
      Object.defineProperty(globalThis, "navigator", {
        value: {
          geolocation: {
            getCurrentPosition: vi.fn((success) => success(mockPosition)),
          },
        },
        writable: true,
        configurable: true,
      });

      const pos = await getCurrentPosition();
      expect(pos).toEqual(mockPosition);
      expect(globalThis.navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
    });

    it("should reject when getCurrentPosition fails", async () => {
      const mockError = new Error("User denied Geolocation");
      Object.defineProperty(globalThis, "navigator", {
        value: {
          geolocation: {
            getCurrentPosition: vi.fn((success, error) => error(mockError)),
          },
        },
        writable: true,
        configurable: true,
      });

      await expect(getCurrentPosition()).rejects.toThrow("User denied Geolocation");
    });
  });

  describe("isGeolocationAvailable", () => {
    it("should return false when unavailable", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });
      expect(isGeolocationAvailable()).toBe(false);
    });

    it("should return true when available", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { geolocation: {} },
        writable: true,
        configurable: true,
      });
      expect(isGeolocationAvailable()).toBe(true);
    });
  });

  describe("formatCoords", () => {
    it("should format and round coordinates correctly", () => {
      const result = formatCoords(10.123456, 20.987654);
      expect(result).toEqual({ lat: 10.1235, lng: 20.9877 });
    });
  });

  describe("reverseGeocode", () => {
    beforeEach(() => {
      vi.spyOn(globalThis, "fetch");
    });

    it("should return the correct city from nominatim response", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: { city: "Barcelona" } }),
      } as unknown as Response);

      const city = await reverseGeocode(41.3851, 2.1734);
      expect(city).toBe("Barcelona");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("lat=41.3851&lon=2.1734"),
        expect.any(Object)
      );
    });

    it("should fallback to town, village, municipality, county", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: { town: "Sitges" } }),
      } as unknown as Response);

      expect(await reverseGeocode(41.2372, 1.8059)).toBe("Sitges");
    });

    it("should return empty string on fetch non-ok", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
      } as unknown as Response);

      expect(await reverseGeocode(10, 10)).toBe("");
    });

    it("should return empty string on fetch throw", async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("Network Error"));

      expect(await reverseGeocode(10, 10)).toBe("");
    });

    it("should return empty string on empty address data", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

      expect(await reverseGeocode(10, 10)).toBe("");
    });
  });
});
