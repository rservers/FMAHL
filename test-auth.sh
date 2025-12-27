#!/bin/bash

echo "🧪 Testing Authentication APIs"
echo "================================"

BASE_URL="http://localhost:3000"

echo ""
echo "1️⃣ Testing Signup..."
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "provider"
  }')

echo "$SIGNUP_RESPONSE" | jq '.'

TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.token')

echo ""
echo "2️⃣ Testing Me API..."
curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo ""
echo "3️⃣ Testing Login..."
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq '.'

echo ""
echo "✅ Tests complete!"
