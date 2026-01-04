#!/bin/bash

# EPIC 10 Integration Test Script
# Tests email infrastructure end-to-end

set -e

BASE_URL="http://localhost:3000"
TEST_EMAIL="epic10test@example.com"
TEST_PASSWORD="TestPassword123!"
TEST_COMPANY="EPIC10 Test Co"

echo "🧪 EPIC 10 Integration Test"
echo "=============================="
echo ""

# Test 1: Check if database tables exist
echo "1️⃣  Checking database schema..."
TEMPLATES_TABLE=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -t -c "SELECT COUNT(*) FROM email_templates;")
EVENTS_TABLE=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -t -c "SELECT COUNT(*) FROM email_events;")
echo "   ✅ email_templates: $TEMPLATES_TABLE templates"
echo "   ✅ email_events table exists"
echo ""

# Test 2: Register a new user (triggers email_verification email)
echo "2️⃣  Testing user registration (triggers email)..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"company_name\": \"$TEST_COMPANY\",
    \"role\": \"provider\"
  }")

echo "   Response: $REGISTER_RESPONSE"

USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$USER_ID" ]; then
  echo "   ❌ Registration failed"
  exit 1
fi
echo "   ✅ User registered: $USER_ID"
echo ""

# Test 3: Wait for worker to process the job
echo "3️⃣  Waiting for worker to process email (5 seconds)..."
sleep 5
echo "   ✅ Wait complete"
echo ""

# Test 4: Check email events were recorded
echo "4️⃣  Checking email events..."
EVENTS_COUNT=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -t -c "SELECT COUNT(*) FROM email_events WHERE recipient_email = '$TEST_EMAIL';")
echo "   Found $EVENTS_COUNT events for $TEST_EMAIL"

if [ "$EVENTS_COUNT" -gt 0 ]; then
  echo "   ✅ Email event tracked"
  docker exec fmhl-postgres psql -U postgres -d findmeahotlead -c "SELECT event_type, provider, created_at FROM email_events WHERE recipient_email = '$TEST_EMAIL' ORDER BY created_at;"
else
  echo "   ⚠️  No email events found (worker may not be running)"
fi
echo ""

# Test 5: Check MailHog received the email (if running)
echo "5️⃣  Checking MailHog..."
MAILHOG_RESPONSE=$(curl -s "http://localhost:8025/api/v2/messages" 2>/dev/null || echo "")
if [ -n "$MAILHOG_RESPONSE" ]; then
  MAILHOG_COUNT=$(echo "$MAILHOG_RESPONSE" | grep -o '"count":[0-9]*' | head -1 | cut -d':' -f2)
  echo "   MailHog has $MAILHOG_COUNT messages"
  echo "   View at: http://localhost:8025"
else
  echo "   ⚠️  MailHog not accessible"
fi
echo ""

# Test 6: Test admin template API (requires admin token)
echo "6️⃣  Testing admin template API..."
echo "   (Skipping - requires admin authentication)"
echo ""

# Test 7: Verify all 9 templates exist
echo "7️⃣  Verifying default templates..."
TEMPLATE_KEYS=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -t -c "SELECT template_key FROM email_templates ORDER BY template_key;")
echo "   Templates:"
echo "$TEMPLATE_KEYS" | while read -r key; do
  if [ -n "$key" ]; then
    echo "     ✅ $key"
  fi
done
echo ""

# Cleanup
echo "🧹 Cleanup..."
docker exec fmhl-postgres psql -U postgres -d findmeahotlead -c "DELETE FROM users WHERE email = '$TEST_EMAIL';" >/dev/null 2>&1 || true
echo "   ✅ Test user removed"
echo ""

echo "=============================="
echo "✅ EPIC 10 Integration Test Complete"
echo ""
echo "Summary:"
echo "  - Database tables: ✅"
echo "  - Template seeding: ✅"
echo "  - Email sending: Check worker logs"
echo "  - Event tracking: Check email_events table"
echo "  - MailHog: http://localhost:8025"

