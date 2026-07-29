// GPS helpers

import { roundCoord } from "./utils";

export function getCurrentPosition(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function isGeolocationAvailable(): boolean {
  return !!navigator.geolocation;
}

export function formatCoords(lat: number, lng: number): {
  lat: number;
  lng: number;
} {
  return {
    lat: roundCoord(lat),
    lng: roundCoord(lng),
  };
}

/**
 * Best-effort reverse geocoding via Nominatim (OpenStreetMap) — one call per
 * capture, well under their 1 req/s policy. Browsers forbid a custom
 * User-Agent header, so the page Referer identifies the app instead.
 * Returns "" on any failure — callers must never block on this.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=es`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const a = data.address || {};
    return a.city || a.town || a.village || a.municipality || a.county || "";
  } catch {
    return "";
  }
}
