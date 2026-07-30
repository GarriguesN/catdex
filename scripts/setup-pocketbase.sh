#!/bin/bash
# PocketBase collection setup for CatDex v3
# Usage: PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... bash setup-pocketbase.sh
# Credentials MUST be set as env vars — NEVER hardcoded.

set -euo pipefail

if [ -z "${PB_ADMIN_EMAIL:-}" ] || [ -z "${PB_ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables."
  exit 1
fi

BASE="${PB_URL:-http://127.0.0.1:8090}"

echo "Authenticating..."
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

echo "Getting collection IDs..."
USERS_ID=$(curl -s "$BASE/api/collections?filter=(name='users')" -H "$H" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'][0]['id'])")

# Drop existing if recreating
for coll in photos achievements friendships cats; do
  ID=$(curl -s "$BASE/api/collections?filter=(name='$coll')" -H "$H" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print(items[0]['id'] if items else '')" 2>/dev/null)
  if [ -n "$ID" ]; then
    curl -s -X DELETE "$BASE/api/collections/$ID" -H "$H" > /dev/null
    echo "Dropped $coll"
  fi
done

# ── cats ──
CATS_ID=$(curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
  \"name\": \"cats\",
  \"type\": \"base\",
  \"fields\": [
    {\"autogeneratePattern\":\"[a-z0-9]{24}\",\"name\":\"id\",\"required\":true,\"type\":\"text\",\"primaryKey\":true},
    {\"name\":\"name\",\"type\":\"text\",\"required\":true},
    {\"name\":\"hash\",\"type\":\"text\"},
    {\"name\":\"discoveredBy\",\"type\":\"relation\",\"collectionId\":\"$USERS_ID\"},
    {\"name\":\"photoCount\",\"type\":\"number\",\"min\":0},
    {\"name\":\"notes\",\"type\":\"text\"},
    {\"name\":\"manuallyNamed\",\"type\":\"bool\"},
    {\"name\":\"created\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":false},
    {\"name\":\"updated\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":true}
  ],
  \"listRule\": \"@request.auth.id != ''\",
  \"viewRule\": \"@request.auth.id != ''\",
  \"createRule\": \"@request.auth.id != ''\",
  \"updateRule\": \"@request.auth.id != ''\",
  \"deleteRule\": \"discoveredBy = @request.auth.id\"
}" | python3 -c "import sys,json; print('cats:', json.load(sys.stdin).get('id','ERR'))")

# ── photos ──
PHOTOS_ID=$(curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
  \"name\": \"photos\",
  \"type\": \"base\",
  \"fields\": [
    {\"autogeneratePattern\":\"[a-z0-9]{24}\",\"name\":\"id\",\"required\":true,\"type\":\"text\",\"primaryKey\":true},
    {\"name\":\"cat\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$CATS_ID\"},
    {\"name\":\"user\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
    {\"name\":\"photo\",\"type\":\"file\",\"required\":true,\"maxSize\":2097152,\"mimeTypes\":[\"image/jpeg\",\"image/png\",\"image/webp\"]},
    {\"name\":\"thumb\",\"type\":\"file\",\"maxSize\":524288,\"mimeTypes\":[\"image/jpeg\",\"image/png\",\"image/webp\"]},
    {\"name\":\"lat\",\"type\":\"number\"},
    {\"name\":\"lng\",\"type\":\"number\"},
    {\"name\":\"city\",\"type\":\"text\"},
    {\"name\":\"phash\",\"type\":\"text\"},
    {\"name\":\"width\",\"type\":\"number\"},
    {\"name\":\"height\",\"type\":\"number\"},
    {\"name\":\"created\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":false},
    {\"name\":\"updated\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":true}
  ],
  \"listRule\": \"@request.auth.id != ''\",
  \"viewRule\": \"@request.auth.id != ''\",
  \"createRule\": \"@request.auth.id != ''\",
  \"updateRule\": \"user = @request.auth.id\",
  \"deleteRule\": \"user = @request.auth.id\"
}" | python3 -c "import sys,json; print('photos:', json.load(sys.stdin).get('id','ERR'))")

# ── achievements ──
ACH_ID=$(curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
  \"name\": \"achievements\",
  \"type\": \"base\",
  \"fields\": [
    {\"autogeneratePattern\":\"[a-z0-9]{24}\",\"name\":\"id\",\"required\":true,\"type\":\"text\",\"primaryKey\":true},
    {\"name\":\"user\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
    {\"name\":\"badgeCode\",\"type\":\"text\",\"required\":true},
    {\"name\":\"unlockedAt\",\"type\":\"number\",\"required\":true},
    {\"name\":\"created\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":false},
    {\"name\":\"updated\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":true}
  ],
  \"listRule\": \"@request.auth.id != ''\",
  \"viewRule\": \"@request.auth.id != ''\",
  \"createRule\": null,
  \"updateRule\": null
}" | python3 -c "import sys,json; print('achievements:', json.load(sys.stdin).get('id','ERR'))")

# ── friendships ──
# updateRule: only the addressee may flip pending → accepted (the hook in
# pb_hooks/friendships.pb.js additionally blocks duplicates and field edits).
# deleteRule: either side can cancel/decline/unfriend — modeled as row delete.
FRIEND_ID=$(curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
  \"name\": \"friendships\",
  \"type\": \"base\",
  \"fields\": [
    {\"autogeneratePattern\":\"[a-z0-9]{24}\",\"name\":\"id\",\"required\":true,\"type\":\"text\",\"primaryKey\":true},
    {\"name\":\"requester\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
    {\"name\":\"addressee\",\"type\":\"relation\",\"required\":true,\"collectionId\":\"$USERS_ID\"},
    {\"name\":\"status\",\"type\":\"select\",\"required\":true,\"maxSelect\":1,\"values\":[\"pending\",\"accepted\"]},
    {\"name\":\"created\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":false},
    {\"name\":\"updated\",\"type\":\"autodate\",\"onCreate\":true,\"onUpdate\":true}
  ],
  \"listRule\": \"@request.auth.id != '' && (requester = @request.auth.id || addressee = @request.auth.id)\",
  \"viewRule\": \"@request.auth.id != '' && (requester = @request.auth.id || addressee = @request.auth.id)\",
  \"createRule\": \"@request.auth.id != '' && requester = @request.auth.id && requester != addressee\",
  \"updateRule\": \"@request.auth.id != '' && addressee = @request.auth.id\",
  \"deleteRule\": \"@request.auth.id != '' && (requester = @request.auth.id || addressee = @request.auth.id)\"
}" | python3 -c "import sys,json; print('friendships:', json.load(sys.stdin).get('id','ERR'))")

# ── shares ──
# createRule only checks sharedBy — ownership of the cat itself is enforced
# in pb_hooks/shares.pb.js (avoids relying on relation back-reference syntax
# in the filter, which is version-sensitive; see FRIENDS_PLAN.md 3.5).
SHARES_ID=$(curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
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
}" | python3 -c "import sys,json; print('shares:', json.load(sys.stdin).get('id','ERR'))")

# ── notifications ──
# createRule is null: only server hooks (pb_hooks/notifications.pb.js) write
# these, same lockdown pattern as achievements.
NOTIF_ID=$(curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
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
}" | python3 -c "import sys,json; print('notifications:', json.load(sys.stdin).get('id','ERR'))")

# ── push_subscriptions ──
PUSH_ID=$(curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
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
}" | python3 -c "import sys,json; print('push_subscriptions:', json.load(sys.stdin).get('id','ERR'))")

# ── weekly_snapshots ──
SNAP_ID=$(curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
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
}" | python3 -c "import sys,json; print('weekly_snapshots:', json.load(sys.stdin).get('id','ERR'))")

# ── duels ──
DUELS_ID=$(curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
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
  \"createRule\": \"@request.auth.id != '' && challenger = @request.auth.id\",
  \"updateRule\": null,
  \"deleteRule\": \"@request.auth.id != '' && (challenger = @request.auth.id || opponent = @request.auth.id)\"
}" | python3 -c "import sys,json; print('duels:', json.load(sys.stdin).get('id','ERR'))")

# ── users: inviteCode field + unique index, gamification fields ──
echo "Patching users with inviteCode + gamification fields..."
curl -s "$BASE/api/collections/$USERS_ID" -H "$H" | python3 -c "
import sys, json
c = json.load(sys.stdin)
patch = {}
fields = c['fields']
if not any(f['name'] == 'inviteCode' for f in fields):
    fields = fields + [{'name': 'inviteCode', 'type': 'text'}]
if not any(f['name'] == 'currentStreak' for f in fields):
    fields = fields + [{'name': 'currentStreak', 'type': 'number', 'min': 0}]
if not any(f['name'] == 'lastCaptureDate' for f in fields):
    fields = fields + [{'name': 'lastCaptureDate', 'type': 'text'}]
if fields != c['fields']:
    patch['fields'] = fields
idx = \"CREATE UNIQUE INDEX idx_users_inviteCode ON users (inviteCode) WHERE inviteCode != ''\"
if not any('idx_users_inviteCode' in i for i in c.get('indexes', [])):
    patch['indexes'] = c.get('indexes', []) + [idx]
print(json.dumps(patch))
" > /tmp/users_patch.json
if [ "$(cat /tmp/users_patch.json)" != "{}" ]; then
  curl -s -X PATCH "$BASE/api/collections/$USERS_ID" -H "$H" -H "$CT" -d @/tmp/users_patch.json > /dev/null
  echo "users: inviteCode + gamification fields added"
fi
rm -f /tmp/users_patch.json

echo "✅ Setup complete with security rules."
