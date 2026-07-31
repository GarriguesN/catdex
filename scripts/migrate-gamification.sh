#!/bin/bash
# Incremental, NON-destructive migration for the gamification release
# (streak tracking + capture sharing) — safe to run against the live instance.
#
# What it does:
#   1. Adds `currentStreak` (number) to users.
#   2. Adds `lastCaptureDate` (text, "YYYY-MM-DD") to users.
#   3. Creates the `shares` collection (skips if present).
#   4. Creates the `notifications` collection (skips if present).
#   5. Creates the `push_subscriptions` collection (skips if present).
#   6. Creates the `weekly_snapshots` collection (skips if present).
#   7. Creates the `duels` collection (skips if present).
#   8. Creates the `reactions` collection (skips if present).
#   9. Adds `dedicatedTo` (relation) + `message` (text) to `shares`, for postcards.
#
# Usage: PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... bash migrate-gamification.sh
# Credentials MUST be set as env vars — NEVER hardcoded.

set -euo pipefail

if [ -z "${PB_ADMIN_EMAIL:-}" ] || [ -z "${PB_ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables."
  exit 1
fi

BASE="${PB_URL:-https://catdex.nglab.es/pb}"

echo "Authenticating against $BASE..."
TOKEN=$(curl -s -X POST "$BASE/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Authentication failed."
  exit 1
fi

H="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"

get_coll_id() {
  curl -s "$BASE/api/collections?filter=(name='$1')" -H "$H" \
    | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print(items[0]['id'] if items else '')"
}

USERS_ID=$(get_coll_id users)
CATS_ID=$(get_coll_id cats)
PHOTOS_ID=$(get_coll_id photos)

# ── users.currentStreak + users.lastCaptureDate ──
echo "Adding currentStreak/lastCaptureDate fields to users..."
curl -s "$BASE/api/collections/$USERS_ID" -H "$H" | python3 -c "
import sys, json
c = json.load(sys.stdin)
fields = c['fields']
added = []
if not any(f['name'] == 'currentStreak' for f in fields):
    fields = fields + [{'name': 'currentStreak', 'type': 'number', 'min': 0}]
    added.append('currentStreak')
if not any(f['name'] == 'lastCaptureDate' for f in fields):
    fields = fields + [{'name': 'lastCaptureDate', 'type': 'text'}]
    added.append('lastCaptureDate')
print(json.dumps({'fields': fields} if added else {}))
" > /tmp/catdex_patch.json
if [ "$(cat /tmp/catdex_patch.json)" != "{}" ]; then
  curl -s -X PATCH "$BASE/api/collections/$USERS_ID" -H "$H" -H "$CT" -d @/tmp/catdex_patch.json > /dev/null
  echo "  users.currentStreak / users.lastCaptureDate added"
else
  echo "  users.currentStreak / users.lastCaptureDate already present"
fi
rm -f /tmp/catdex_patch.json

# ── shares collection ──
SHARES_ID=$(get_coll_id shares)
if [ -n "$SHARES_ID" ]; then
  echo "shares collection already exists ($SHARES_ID)"
else
  echo "Creating shares collection..."
  curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
    \"name\": \"shares\",
    \"type\": \"base\",
    \"fields\": [
      {\"autogeneratePattern\":\"[a-z0-9]{24}\",\"name\":\"id\",\"required\":true,\"type\":\"text\",\"primaryKey\":true},
      {\"name\":\"cat\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$CATS_ID\"},
      {\"name\":\"sharedBy\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
      {\"name\":\"token\",\"type\":\"text\",\"required\":true},
      {\"name\":\"created\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":false}
    ],
    \"indexes\": [\"CREATE UNIQUE INDEX idx_shares_token ON shares (token)\"],
    \"listRule\": \"@request.auth.id != '' && sharedBy = @request.auth.id\",
    \"viewRule\": \"@request.auth.id != '' && sharedBy = @request.auth.id\",
    \"createRule\": \"@request.auth.id != '' && sharedBy = @request.auth.id\",
    \"updateRule\": null,
    \"deleteRule\": \"@request.auth.id != '' && sharedBy = @request.auth.id\"
  }" | python3 -c "import sys,json; print('  shares:', json.load(sys.stdin).get('id','ERR'))"
fi

# ── notifications collection ──
NOTIF_ID=$(get_coll_id notifications)
if [ -n "$NOTIF_ID" ]; then
  echo "notifications collection already exists ($NOTIF_ID)"
else
  echo "Creating notifications collection..."
  curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
    \"name\": \"notifications\",
    \"type\": \"base\",
    \"fields\": [
      {\"autogeneratePattern\":\"[a-z0-9]{24}\",\"name\":\"id\",\"required\":true,\"type\":\"text\",\"primaryKey\":true},
      {\"name\":\"user\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
      {\"name\":\"type\",\"type\":\"select\",\"required\":true,\"maxSelect\":1,\"values\":[\"friend_request\",\"share\",\"reaction\"]},
      {\"name\":\"refId\",\"type\":\"text\"},
      {\"name\":\"read\",\"type\":\"bool\"},
      {\"name\":\"created\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":false}
    ],
    \"listRule\": \"@request.auth.id != '' && user = @request.auth.id\",
    \"viewRule\": \"@request.auth.id != '' && user = @request.auth.id\",
    \"createRule\": null,
    \"updateRule\": \"@request.auth.id != '' && user = @request.auth.id\",
    \"deleteRule\": \"@request.auth.id != '' && user = @request.auth.id\"
  }" | python3 -c "import sys,json; print('  notifications:', json.load(sys.stdin).get('id','ERR'))"
fi

# ── push_subscriptions collection ──
PUSH_ID=$(get_coll_id push_subscriptions)
if [ -n "$PUSH_ID" ]; then
  echo "push_subscriptions collection already exists ($PUSH_ID)"
else
  echo "Creating push_subscriptions collection..."
  curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
    \"name\": \"push_subscriptions\",
    \"type\": \"base\",
    \"fields\": [
      {\"autogeneratePattern\":\"[a-z0-9]{24}\",\"name\":\"id\",\"required\":true,\"type\":\"text\",\"primaryKey\":true},
      {\"name\":\"user\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
      {\"name\":\"endpoint\",\"type\":\"text\",\"required\":true},
      {\"name\":\"p256dh\",\"type\":\"text\",\"required\":true},
      {\"name\":\"auth\",\"type\":\"text\",\"required\":true},
      {\"name\":\"created\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":false}
    ],
    \"indexes\": [\"CREATE UNIQUE INDEX idx_push_subscriptions_endpoint ON push_subscriptions (endpoint)\"],
    \"listRule\": \"@request.auth.id != '' && user = @request.auth.id\",
    \"viewRule\": \"@request.auth.id != '' && user = @request.auth.id\",
    \"createRule\": \"@request.auth.id != '' && user = @request.auth.id\",
    \"updateRule\": null,
    \"deleteRule\": \"@request.auth.id != '' && user = @request.auth.id\"
  }" | python3 -c "import sys,json; print('  push_subscriptions:', json.load(sys.stdin).get('id','ERR'))"
fi

# ── weekly_snapshots collection ──
SNAP_ID=$(get_coll_id weekly_snapshots)
if [ -n "$SNAP_ID" ]; then
  echo "weekly_snapshots collection already exists ($SNAP_ID)"
else
  echo "Creating weekly_snapshots collection..."
  curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
    \"name\": \"weekly_snapshots\",
    \"type\": \"base\",
    \"fields\": [
      {\"autogeneratePattern\":\"[a-z0-9]{24}\",\"name\":\"id\",\"required\":true,\"type\":\"text\",\"primaryKey\":true},
      {\"name\":\"user\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
      {\"name\":\"weekKey\",\"type\":\"text\",\"required\":true},
      {\"name\":\"score\",\"type\":\"number\",\"required\":true},
      {\"name\":\"created\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":false}
    ],
    \"indexes\": [\"CREATE UNIQUE INDEX idx_weekly_snapshots_user_week ON weekly_snapshots (user, weekKey)\"],
    \"listRule\": \"@request.auth.id != ''\",
    \"viewRule\": \"@request.auth.id != ''\",
    \"createRule\": null,
    \"updateRule\": null,
    \"deleteRule\": null
  }" | python3 -c "import sys,json; print('  weekly_snapshots:', json.load(sys.stdin).get('id','ERR'))"
fi

# ── duels collection ──
DUELS_ID=$(get_coll_id duels)
if [ -n "$DUELS_ID" ]; then
  echo "duels collection already exists ($DUELS_ID)"
else
  echo "Creating duels collection..."
  curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
    \"name\": \"duels\",
    \"type\": \"base\",
    \"fields\": [
      {\"autogeneratePattern\":\"[a-z0-9]{24}\",\"name\":\"id\",\"required\":true,\"type\":\"text\",\"primaryKey\":true},
      {\"name\":\"challenger\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
      {\"name\":\"opponent\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
      {\"name\":\"status\",\"type\":\"select\",\"required\":true,\"maxSelect\":1,\"values\":[\"active\",\"finished\"]},
      {\"name\":\"endsAt\",\"type\":\"date\",\"required\":true},
      {\"name\":\"challengerStartScore\",\"type\":\"number\",\"required\":true},
      {\"name\":\"opponentStartScore\",\"type\":\"number\",\"required\":true},
      {\"name\":\"winnerSide\",\"type\":\"select\",\"maxSelect\":1,\"values\":[\"challenger\",\"opponent\",\"tie\"]},
      {\"name\":\"created\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":false}
    ],
    \"listRule\": \"@request.auth.id != '' && (challenger = @request.auth.id || opponent = @request.auth.id)\",
    \"viewRule\": \"@request.auth.id != '' && (challenger = @request.auth.id || opponent = @request.auth.id)\",
    \"createRule\": \"@request.auth.id != ''\",
    \"updateRule\": null,
    \"deleteRule\": \"@request.auth.id != '' && (challenger = @request.auth.id || opponent = @request.auth.id)\"
  }" | python3 -c "import sys,json; print('  duels:', json.load(sys.stdin).get('id','ERR'))"
fi

# ── reactions collection ──
REACT_ID=$(get_coll_id reactions)
if [ -n "$REACT_ID" ]; then
  echo "reactions collection already exists ($REACT_ID)"
else
  echo "Creating reactions collection..."
  curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
    \"name\": \"reactions\",
    \"type\": \"base\",
    \"fields\": [
      {\"autogeneratePattern\":\"[a-z0-9]{24}\",\"name\":\"id\",\"required\":true,\"type\":\"text\",\"primaryKey\":true},
      {\"name\":\"photo\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$PHOTOS_ID\"},
      {\"name\":\"user\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
      {\"name\":\"emoji\",\"type\":\"select\",\"required\":true,\"maxSelect\":1,\"values\":[\"🐾\",\"❤️\",\"😻\",\"😂\"]},
      {\"name\":\"created\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":false},
      {\"name\":\"updated\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":true}
    ],
    \"indexes\": [\"CREATE UNIQUE INDEX idx_reactions_photo_user ON reactions (photo, user)\"],
    \"listRule\": \"@request.auth.id != ''\",
    \"viewRule\": \"@request.auth.id != ''\",
    \"createRule\": \"@request.auth.id != '' && user = @request.auth.id\",
    \"updateRule\": \"@request.auth.id != '' && user = @request.auth.id\",
    \"deleteRule\": \"@request.auth.id != '' && user = @request.auth.id\"
  }" | python3 -c "import sys,json; print('  reactions:', json.load(sys.stdin).get('id','ERR'))"
fi

# ── shares: dedicatedTo + message, for postcards (C.4) ──
echo "Adding dedicatedTo/message fields to shares..."
curl -s "$BASE/api/collections/$(get_coll_id shares)" -H "$H" | python3 -c "
import sys, json
c = json.load(sys.stdin)
fields = c['fields']
added = []
if not any(f['name'] == 'dedicatedTo' for f in fields):
    fields = fields + [{'name': 'dedicatedTo', 'type': 'relation', 'collectionId': '$USERS_ID'}]
    added.append('dedicatedTo')
if not any(f['name'] == 'message' for f in fields):
    fields = fields + [{'name': 'message', 'type': 'text'}]
    added.append('message')
print(json.dumps({'fields': fields} if added else {}))
" > /tmp/catdex_patch.json
if [ "$(cat /tmp/catdex_patch.json)" != "{}" ]; then
  curl -s -X PATCH "$BASE/api/collections/$(get_coll_id shares)" -H "$H" -H "$CT" -d @/tmp/catdex_patch.json > /dev/null
  echo "  shares.dedicatedTo / shares.message added"
else
  echo "  shares.dedicatedTo / shares.message already present"
fi
rm -f /tmp/catdex_patch.json

echo "✅ Migration complete. Remember to:"
echo "   1. Deploy pb_hooks/*.pb.js to /opt/pocketbase/pb_hooks/ and restart PocketBase."
echo "   2. Set VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_SUBJECT and"
echo "      PUSH_INTERNAL_SECRET in the Next.js deploy's env."
echo "   3. Set PUSH_INTERNAL_SECRET and PUSH_INTERNAL_URL in PocketBase's OWN process"
echo "      env (read via \$os.getenv in pb_hooks/push-utils.js) — a different process"
echo "      env than the Next.js one, even if both run on the same host (CT 120)."
