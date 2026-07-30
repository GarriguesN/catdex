#!/bin/bash
# Incremental, NON-destructive migration for the gamification release
# (streak tracking) — safe to run against the live instance.
#
# What it does:
#   1. Adds `currentStreak` (number) to users.
#   2. Adds `lastCaptureDate` (text, "YYYY-MM-DD") to users.
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

echo "✅ Migration complete. Remember to deploy pb_hooks/scoring.pb.js to /opt/pocketbase/pb_hooks/ and restart PocketBase."
