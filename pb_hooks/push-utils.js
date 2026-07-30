/**
 * Shared Web Push sender — require()d from hooks that need to notify a user
 * (not auto-loaded: only *.pb.js files are executed by PocketBase).
 *
 * The actual VAPID signing happens in app/api/push/send/route.ts (Next.js),
 * not here — goja has no crypto module, see GAMIFICATION_PLAN.md A.3.
 *
 * Requires PUSH_INTERNAL_SECRET and PUSH_INTERNAL_URL in PocketBase's OWN
 * process env (not the Next.js one, even if both run on the same host) —
 * set these wherever PocketBase's service/process env is configured.
 */

module.exports = {
  /** Sends a push to every device a user is subscribed on. Best-effort. */
  sendPush(userId, title, body, url) {
    if (!userId) return;

    const secret = $os.getenv("PUSH_INTERNAL_SECRET");
    const base = $os.getenv("PUSH_INTERNAL_URL") || "http://127.0.0.1:3000";
    if (!secret) {
      console.error("[catdex:push] PUSH_INTERNAL_SECRET not set — skipping");
      return;
    }

    let subs = [];
    try {
      subs = $app.findRecordsByFilter("push_subscriptions", "user = {:u}", "", 0, 0, { u: userId });
    } catch (err) {
      console.error("[catdex:push] subscription lookup failed:", err);
      return;
    }

    subs.forEach((sub) => {
      try {
        const res = $http.send({
          url: `${base}/api/push/send`,
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
          body: JSON.stringify({
            subscription: {
              endpoint: sub.get("endpoint"),
              keys: { p256dh: sub.get("p256dh"), auth: sub.get("auth") },
            },
            payload: { title, body, url },
          }),
        });

        // Dead subscription (browser revoked/uninstalled) — clean it up so
        // future sends don't keep retrying it. $app bypasses collection
        // rules, so this is safe even though only the owning user's client
        // can delete their own row via the normal API.
        if (res.statusCode === 502 && (res.json?.statusCode === 404 || res.json?.statusCode === 410)) {
          $app.delete(sub);
        }
      } catch (err) {
        console.error("[catdex:push] send failed:", err);
      }
    });
  },
};
