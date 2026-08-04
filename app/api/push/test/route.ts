import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

/**
 * Unauthenticated test endpoint to check push functionality.
 * Only accepts a subscription object and strictly hardcodes the payload on the server.
 */
export async function POST(req: NextRequest) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    console.error("[push] VAPID env vars not configured");
    return NextResponse.json({ error: "Push not configured" }, { status: 500 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { subscription } = await req.json();
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const payload = {
    title: "¡Prueba de notificación!",
    body: "Si ves esto, las notificaciones de CatDex funcionan correctamente.",
    url: "/",
  };

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    console.error("[push] test send failed:", statusCode, err);
    return NextResponse.json({ error: "Send failed", statusCode }, { status: 502 });
  }
}
