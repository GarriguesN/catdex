/** Camera debug overlay preference — localStorage-backed, defaults to off. */

const KEY = "catdex_debug_camera";

export function isDebugCameraEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function setDebugCameraEnabled(enabled: boolean) {
  localStorage.setItem(KEY, enabled ? "1" : "0");
}
