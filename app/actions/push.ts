"use server";

import webpush from "web-push";

export async function sendTestNotificationAction(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    console.error("[push] VAPID env vars not configured");
    throw new Error("Push not configured");
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const payload = {
    title: "¡Prueba de notificación!",
    body: "Si ves esto, las notificaciones de CatDex funcionan correctamente.",
    url: "/",
  };

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true };
  } catch (err: unknown) {
    console.error("[push] sendTestNotificationAction failed:", err);
    return { success: false, error: "Send failed" };
  }
}
