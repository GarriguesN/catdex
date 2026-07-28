#!/bin/bash
# Create PocketBase collections for CatDex v3
# Usage: run on CT 120

BASE="http://127.0.0.1:8090"
TOKEN=$(curl -s -X POST "$BASE/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d '{"identity":"natxio@nglab.es","password":"CatDex2026!Secure"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

H="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"

# Drop collections if they exist (to start fresh)
for coll in photos achievements cats; do
  ID=$(curl -s -X GET "$BASE/api/collections?filter=(name='$coll')" -H "$H" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print(items[0]['id'] if items else '')" 2>/dev/null)
  if [ -n "$ID" ]; then
    curl -s -X DELETE "$BASE/api/collections/$ID" -H "$H" > /dev/null
    echo "Dropped $coll"
  fi
done

# ── users collection (extends _superusers for OAuth) ──
echo "Creating users collection..."
curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d '{
  "name": "users",
  "type": "auth",
  "authOptions": {
    "manageRule": null,
    "allowOAuth2Auth": true,
    "allowUsernameAuth": false,
    "allowEmailAuth": true,
    "minPasswordLength": 8,
    "requireEmail": true,
    "onlyVerified": false
  }
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','ERROR: '+str(d)))"

# Add fields to users: avatar (file), score (number)
USERS_ID=$(curl -s "$BASE/api/collections?filter=(name='users')" -H "$H" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'][0]['id'])")

curl -s -X PATCH "$BASE/api/collections/$USERS_ID" -H "$H" -H "$CT" -d '{
  "fields": [
    {"autogeneratePattern": "[a-z0-9]{24}","name": "id","required": true,"type": "text","primaryKey": true},
    {"name": "name","type": "text","required": false},
    {"name": "avatar","type": "file","required": false,"maxSize": 5242880,"mimeTypes": ["image/jpeg","image/png","image/webp"]},
    {"name": "score","type": "number","required": false,"min": 0,"max": null},
    {"name": "email","type": "email","required": true,"unique": true},
    {"name": "provider","type": "text","required": false},
    {"name": "providerId","type": "text","required": false}
  ]
}' > /dev/null && echo "users updated"

# ── cats collection ──
curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d '{
  "name": "cats",
  "type": "base",
  "schema": [
    {"name": "name","type": "text","required": true},
    {"name": "hash","type": "text","required": false},
    {"name": "discoveredBy","type": "relation","required": false,"collectionId": "'$USERS_ID'","cascadeDelete": false},
    {"name": "photoCount","type": "number","required": false,"min": 0},
    {"name": "notes","type": "text","required": false},
    {"name": "manuallyNamed","type": "bool","required": false}
  ],
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": ""
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('cats:', d.get('id','ERROR: '+str(d)))"

CATS_ID=$(curl -s "$BASE/api/collections?filter=(name='cats')" -H "$H" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'][0]['id'])")

# ── photos collection ──
curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d '{
  "name": "photos",
  "type": "base",
  "schema": [
    {"name": "cat","type": "relation","required": true,"collectionId": "'$CATS_ID'","cascadeDelete": false},
    {"name": "user","type": "relation","required": true,"collectionId": "'$USERS_ID'","cascadeDelete": false},
    {"name": "photo","type": "file","required": true,"maxSize": 2097152,"mimeTypes": ["image/jpeg","image/png","image/webp"]},
    {"name": "thumb","type": "file","required": false,"maxSize": 524288,"mimeTypes": ["image/jpeg","image/png","image/webp"]},
    {"name": "lat","type": "number","required": false},
    {"name": "lng","type": "number","required": false},
    {"name": "phash","type": "text","required": false},
    {"name": "width","type": "number","required": false},
    {"name": "height","type": "number","required": false}
  ],
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": ""
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('photos:', d.get('id','ERROR: '+str(d)))"

# ── achievements collection ──
curl -s -X POST "$BASE/api/collections" -H "$H" -H "$CT" -d '{
  "name": "achievements",
  "type": "base",
  "schema": [
    {"name": "user","type": "relation","required": true,"collectionId": "'$USERS_ID'","cascadeDelete": false},
    {"name": "badgeCode","type": "text","required": true},
    {"name": "unlockedAt","type": "number","required": true}
  ],
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": ""
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('achievements:', d.get('id','ERROR: '+str(d)))"

echo "✅ Done!"
