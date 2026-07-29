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
for coll in photos achievements cats; do
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

echo "✅ Setup complete with security rules."
