// Platform / install-state detection shared by the install banner and the
// OAuth login flow (window.open()-based popups are unreliable once the app
// runs as an installed standalone PWA — see app/login/page.tsx).

export function isIOS(): boolean {
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
}

export function isAndroid(): boolean {
  return /android/.test(navigator.userAgent.toLowerCase());
}

/** True once the app is running installed (standalone), not in a browser tab. */
export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's pre-matchMedia flag for home-screen-launched apps
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
