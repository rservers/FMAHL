#!/bin/bash

# EPIC 02 Integration Test Script
# Tests lead submission, confirmation, and resend flows

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_URL="${API_URL:-$BASE_URL/api/v1}"

echo "🧪 EPIC 02 Integration Tests"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

test() {
  local name="$1"
  local command="$2"
  
  echo -n "Testing: $name... "
  
  if eval "$command" > /tmp/test-output.log 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAILED${NC}"
    cat /tmp/test-output.log | head -10
    FAILED=$((FAILED + 1))
  fi
}

# 1. Get VPS niche form schema
echo "📋 Phase 1: Get Form Schema"
echo "---------------------------"

VPS_NICHE_ID=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -t -c "SELECT id FROM niches WHERE slug = 'vps-hosting' LIMIT 1" | xargs)

if [ -z "$VPS_NICHE_ID" ]; then
  echo -e "${RED}✗ VPS niche not found. Run: npm run db:migrate${NC}"
  exit 1
fi

echo "Found VPS niche ID: $VPS_NICHE_ID"
echo ""

test "GET /api/v1/niches/:id/form-schema" \
  "curl -s -f '$API_URL/niches/$VPS_NICHE_ID/form-schema' | jq -e '.form_schema | length > 0'"

FORM_SCHEMA=$(curl -s "$API_URL/niches/$VPS_NICHE_ID/form-schema")
echo "Form schema fields: $(echo $FORM_SCHEMA | jq '.form_schema | length')"
echo ""

# 2. Submit a lead
echo "📝 Phase 2: Lead Submission"
echo "---------------------------"

LEAD_PAYLOAD=$(cat <<EOF
{
  "niche_id": "$VPS_NICHE_ID",
  "contact_email": "test-lead-$(date +%s)@example.com",
  "contact_name": "Test User",
  "contact_phone": "+1234567890",
  "form_data": {
    "server_type": "vps",
    "cpu_cores": 4,
    "ram_gb": 8,
    "storage_gb": 100,
    "os_preference": "linux"
  },
  "attribution": {
    "utm_source": "test",
    "utm_medium": "script",
    "utm_campaign": "epic02-test"
  }
}
EOF
)

test "POST /api/v1/leads" \
  "curl -s -f -X POST '$API_URL/leads' \
    -H 'Content-Type: application/json' \
    -d '$LEAD_PAYLOAD' | jq -e '.lead_id'"

LEAD_RESPONSE=$(curl -s -X POST "$API_URL/leads" \
  -H 'Content-Type: application/json' \
  -d "$LEAD_PAYLOAD")

LEAD_ID=$(echo $LEAD_RESPONSE | jq -r '.lead_id')
CONFIRMATION_SENT=$(echo $LEAD_RESPONSE | jq -r '.confirmation_sent')

echo "Lead ID: $LEAD_ID"
echo "Confirmation sent: $CONFIRMATION_SENT"
echo ""

# 3. Verify lead in database
echo "🔍 Phase 3: Database Verification"
echo "----------------------------------"

test "Lead exists in database" \
  "docker exec fmhl-postgres psql -U postgres -d findmeahotlead -t -c \"SELECT COUNT(*) FROM leads WHERE id = '$LEAD_ID'\" | grep -q '1'"

LEAD_STATUS=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -t -c "SELECT status FROM leads WHERE id = '$LEAD_ID'" | xargs)
echo "Lead status: $LEAD_STATUS"

if [ "$LEAD_STATUS" != "pending_confirmation" ]; then
  echo -e "${RED}✗ Expected status 'pending_confirmation', got '$LEAD_STATUS'${NC}"
  FAILED=$((FAILED + 1))
else
  echo -e "${GREEN}✓ Status correct${NC}"
  PASSED=$((PASSED + 1))
fi

# Check confirmation token exists
TOKEN_EXISTS=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -t -c "SELECT COUNT(*) FROM leads WHERE id = '$LEAD_ID' AND confirmation_token_hash IS NOT NULL" | xargs)
if [ "$TOKEN_EXISTS" = "1" ]; then
  echo -e "${GREEN}✓ Confirmation token exists${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ Confirmation token missing${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

# 4. Check email event was queued
echo "📧 Phase 4: Email Queue Verification"
echo "-------------------------------------"

# Wait a moment for email to be queued
sleep 2

EMAIL_EVENT=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -t -c "SELECT COUNT(*) FROM email_events WHERE related_entity_id = '$LEAD_ID' AND event_type = 'queued'" | xargs)
if [ "$EMAIL_EVENT" = "1" ]; then
  echo -e "${GREEN}✓ Email queued event recorded${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${YELLOW}⚠ Email event not found (may be async)${NC}"
fi

echo ""

# 5. Test resend confirmation
echo "🔄 Phase 5: Resend Confirmation"
echo "--------------------------------"

test "POST /api/v1/leads/:id/resend-confirmation" \
  "curl -s -f -X POST '$API_URL/leads/$LEAD_ID/resend-confirmation' | jq -e '.resend_count'"

RESEND_RESPONSE=$(curl -s -X POST "$API_URL/leads/$LEAD_ID/resend-confirmation")
RESEND_COUNT=$(echo $RESEND_RESPONSE | jq -r '.resend_count')
echo "Resend count: $RESEND_COUNT"

# Test cooldown (should fail)
echo "Testing cooldown..."
COOLDOWN_RESPONSE=$(curl -s -X POST "$API_URL/leads/$LEAD_ID/resend-confirmation")
if echo "$COOLDOWN_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Cooldown enforced${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ Cooldown not enforced${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

# 6. Test form validation
echo "✅ Phase 6: Form Validation"
echo "----------------------------"

# Test missing required field
INVALID_PAYLOAD=$(cat <<EOF
{
  "niche_id": "$VPS_NICHE_ID",
  "contact_email": "test@example.com",
  "contact_name": "Test",
  "form_data": {
    "server_type": "vps"
    // Missing cpu_cores, ram_gb, storage_gb
  }
}
EOF
)

INVALID_RESPONSE=$(curl -s -X POST "$API_URL/leads" \
  -H 'Content-Type: application/json' \
  -d "$INVALID_PAYLOAD")

if echo "$INVALID_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Validation error returned${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ Validation should have failed${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

# Summary
echo "============================"
echo "Test Summary"
echo "============================"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}Failed: $FAILED${NC}"
  echo ""
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Check MailHog UI: http://localhost:8025"
  echo "2. Get confirmation token from email"
  echo "3. Test confirmation endpoint: GET /api/v1/leads/confirm?token=<token>"
fi

