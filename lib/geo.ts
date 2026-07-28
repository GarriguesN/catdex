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
