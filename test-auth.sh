#!/bin/bash

echo "Testing login..."
RESPONSE=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "founder@trafficpro.dev", "password": "admin123"}' \
  -s)

echo "$RESPONSE" | python3 -m json.tool

TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

echo ""
echo "Testing /api/auth/me with token..."
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  -s | python3 -m json.tool
