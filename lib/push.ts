/**
 * Web Push subscription — device-aware because the permission flow differs
 * a lot by platform: iOS Safari only supports Web Push from an installed
 * PWA (Add to Home Screen), not from a regular browser tab, and only since
 * iOS 16.4. Everywhere else (Android Chrome, desktop browsers) it works
 * directly from the tab.
 */

import { getPocketBase } from "./pocketbase";

export type PushAvailability =
  | "unsupported" // browser has no Push API at all
  | "ios-needs-install" // iOS Safari/PWA, but not added to home screen yet
  | "ready"; // can call subscribeToPush() directly

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS-specific flag, not covered by the media query above on older iOS
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function getPushAvailability(): PushAvailability {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (isIos() && !isStandalone()) return "ios-needs-install";
  return "ready";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

/** Some of the calls below (service worker readiness, the permission prompt
 * itself) have been observed to hang indefinitely on certain WebKit/PWA
 * combinations instead of rejecting — without a timeout that leaves the UI
 * stuck on "working" forever with no error and nothing in the console. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tiempo de espera agotado: ${label}`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Null if not currently subscribed on this device. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (getPushAvailability() !== "ready") return null;
  let reg: ServiceWorkerRegistration;
  try {
    reg = await withTimeout(navigator.serviceWorker.ready, 30000, "service worker");
  } catch {
    // Fallback: try to register/retrieve explicitly
    reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  }
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<void> {
  console.log("[push] subscribeToPush: start");
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error("Push no configurado (falta la clave VAPID pública).");

  const permission = await withTimeout(
    Notification.requestPermission(),
    20000,
    "permiso de notificaciones"
  );
  console.log("[push] permission:", permission);
  if (permission !== "granted") throw new Error("Permiso de notificaciones denegado.");

  let reg: ServiceWorkerRegistration;
  try {
    reg = await withTimeout(navigator.serviceWorker.ready, 30000, "service worker");
  } catch {
    reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  }
  console.log("[push] service worker ready, scope:", reg.scope);
  const subscription =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));
  console.log("[push] subscribed, endpoint:", subscription.endpoint);

  const json = subscription.toJSON();
  const pb = getPocketBase();
  const userId = pb.authStore.record?.id;
  // One row per endpoint (a re-subscribe on the same device reuses the same
  // endpoint) — avoid duplicates if the user toggles this on/off.
  const existing = await pb.collection("push_subscriptions").getFullList({
    filter: `endpoint="${json.endpoint}"`,
    fields: "id",
  });
  if (existing.length === 0) {
    await pb.collection("push_subscriptions").create({
      user: userId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    });
    console.log("[push] push_subscriptions record created");
  } else {
    console.log("[push] push_subscriptions record already exists, skipping create");
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getExistingSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  const pb = getPocketBase();
  const rows = await pb.collection("push_subscriptions").getFullList({
    filter: `endpoint="${endpoint}"`,
    fields: "id",
  });
  await Promise.all(rows.map((r) => pb.collection("push_subscriptions").delete(r.id)));
}
