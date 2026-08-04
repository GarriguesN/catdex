import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

/**
 * The one server-side route in this app (see AGENTS.md/FRIENDS_PLAN.md —
 * everything else lives in pb_hooks). It exists only because PocketBase's
 * JSVM (goja) has no crypto module, so it can't sign the VAPID/ES256 JWT
 * that Web Push requires — see GAMIFICATION_PLAN.md A.3 for the write-up.
 *
 * Called server-to-server by pb_hooks/push-utils.js with a shared secret;
 * never exposed to the browser.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PUSH_INTERNAL_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    console.error("[push] VAPID env vars not configured");
    return NextResponse.json({ error: "Push not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { subscription, payload } = await req.json();
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // 404/410 = the push service says this subscription is dead (browser
    // revoked it, uninstalled, etc). Returned so the caller (pb_hooks, which
    // has $app superuser access) can delete the matching push_subscriptions
    // row instead of retrying it forever.
    const statusCode = (err as { statusCode?: number })?.statusCode;
    console.error("[push] send failed:", statusCode, err);
    return NextResponse.json({ error: "Send failed", statusCode }, { status: 502 });
  }
}
