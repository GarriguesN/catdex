#!/bin/bash
# Incremental, NON-destructive migration for the friends/profile/achievements
# release — safe to run against the live instance (setup-pocketbase.sh drops
# collections and would destroy data; this script only adds).
#
# What it does:
#   1. Adds `city` (text) to photos.
#   2. Adds `inviteCode` (text, unique index) to users.
#   3. Creates the `friendships` collection with its rules (skips if present).
#   4. Creates the `achievements` collection if missing — despite the
#      original plan assuming it already existed in production, a local
#      test against the live instance 404'd on it, so this is no longer
#      assumed (skips if present).
#   5. Backfills invite codes for existing users (new users get one from
#      pb_hooks/invite-codes.pb.js).
#
# Usage: PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... bash migrate-friends.sh
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
PHOTOS_ID=$(get_coll_id photos)

# ── 1. photos.city ──
echo "Adding city field to photos..."
curl -s "$BASE/api/collections/$PHOTOS_ID" -H "$H" | python3 -c "
import sys, json
c = json.load(sys.stdin)
if any(f['name'] == 'city' for f in c['fields']):
    print('{}')
else:
    print(json.dumps({'fields': c['fields'] + [{'name': 'city', 'type': 'text'}]}))
" > /tmp/catdex_patch.json
if [ "$(cat /tmp/catdex_patch.json)" != "{}" ]; then
  curl -s -X PATCH "$BASE/api/collections/$PHOTOS_ID" -H "$H" -H "$CT" -d @/tmp/catdex_patch.json > /dev/null
  echo "  photos.city added"
else
  echo "  photos.city already present"
fi

# ── 2. users.inviteCode + unique index ──
echo "Adding inviteCode field to users..."
curl -s "$BASE/api/collections/$USERS_ID" -H "$H" | python3 -c "
import sys, json
c = json.load(sys.stdin)
patch = {}
if not any(f['name'] == 'inviteCode' for f in c['fields']):
    patch['fields'] = c['fields'] + [{'name': 'inviteCode', 'type': 'text'}]
idx = \"CREATE UNIQUE INDEX idx_users_inviteCode ON users (inviteCode) WHERE inviteCode != ''\"
if not any('idx_users_inviteCode' in i for i in c.get('indexes', [])):
    patch['indexes'] = c.get('indexes', []) + [idx]
print(json.dumps(patch))
" > /tmp/catdex_patch.json
if [ "$(cat /tmp/catdex_patch.json)" != "{}" ]; then
  curl -s -X PATCH "$BASE/api/collections/$USERS_ID" -H "$H" -H "$CT" -d @/tmp/catdex_patch.json > /dev/null
  echo "  users.inviteCode added"
else
  echo "  users.inviteCode already present"
fi
rm -f /tmp/catdex_patch.json

# ── 3. friendships collection ──
FRIEND_ID=$(get_coll_id friendships)
if [ -n "$FRIEND_ID" ]; then
  echo "friendships collection already exists ($FRIEND_ID)"
else
  echo "Creating friendships collection..."
  curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
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
  }" | python3 -c "import sys,json; print('  friendships:', json.load(sys.stdin).get('id','ERR'))"
fi

# ── 4. achievements collection ──
ACH_ID=$(get_coll_id achievements)
if [ -n "$ACH_ID" ]; then
  echo "achievements collection already exists ($ACH_ID)"
else
  echo "Creating achievements collection..."
  curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d "{
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
  }" | python3 -c "import sys,json; print('  achievements:', json.load(sys.stdin).get('id','ERR'))"
fi

# ── 5. Backfill invite codes for existing users ──
echo "Backfilling invite codes..."
curl -s "$BASE/api/collections/users/records?perPage=500&fields=id,inviteCode" -H "$H" \
  | python3 -c "
import sys, json, secrets
items = json.load(sys.stdin)['items']
alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
for u in items:
    if not u.get('inviteCode'):
        code = ''.join(secrets.choice(alphabet) for _ in range(8))
        print(f\"{u['id']} {code}\")
" | while read -r UID CODE; do
  curl -s -X PATCH "$BASE/api/collections/users/records/$UID" -H "$H" -H "$CT" \
    -d "{\"inviteCode\":\"$CODE\"}" > /dev/null
  echo "  $UID → $CODE"
done

echo "✅ Migration complete. Remember to deploy pb_hooks/*.pb.js + achievements-utils.js to /opt/pocketbase/pb_hooks/ and restart PocketBase."
