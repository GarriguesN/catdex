/**
 * Web Push subscription — device-aware because the permission flow differs
 * a lot by platform: iOS Safari only supports Web Push from an installed
 * PWA (Add to Home Screen), not from a regular browser tab, and only since
 * iOS 16.4. Everywhere else (Android Chrome, desktop browsers) it works
 * directly from the tab.
 */

import { getPocketBase } from "./pocketbase";

export type PushAvailability =
  | "unsupported"
  | "ios-needs-install"
  | "ready";

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tiempo de espera agotado: ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // Try ready (should be instant if SW is active)
  try {
    return await withTimeout(navigator.serviceWorker.ready, 5000, "service worker ready");
  } catch {
    // Ignore error and fall through
  }
  // Try existing registration
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // Register fresh
  const reg = await withTimeout(
    navigator.serviceWorker.register("/sw.js"),
    10000,
    "service worker register"
  );
  await withTimeout(navigator.serviceWorker.ready, 10000, "service worker activate");
  return reg;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (getPushAvailability() !== "ready") return null;
  const reg = await getRegistration();
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

  const reg = await getRegistration();
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

/** Send a test push notification to the current device. */
export async function sendTestNotification(): Promise<boolean> {
  const sub = await getExistingSubscription();
  if (!sub) {
    console.warn("[push] sendTestNotification: no subscription");
    return false;
  }
  try {
    const resp = await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_PUSH_INTERNAL_SECRET || ""}`,
      },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        title: "¡Prueba de notificación!",
        body: "Si ves esto, las notificaciones de CatDex funcionan correctamente.",
        url: "/",
      }),
    });
    return resp.ok;
  } catch (err) {
    console.error("[push] sendTestNotification failed:", err);
    return false;
  }
}
