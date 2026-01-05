#!/bin/bash

# EPIC 12 - Observability & Ops Integration Tests
# Tests health checks, metrics, queue monitoring, and DLQ management

set -e

echo "🧪 EPIC 12 - Observability & Ops Tests"
echo "========================================"
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@findmeahotlead.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
  echo "✅ PASS: $1"
  ((TESTS_PASSED++))
  ((TESTS_RUN++))
}

fail() {
  echo "❌ FAIL: $1"
  ((TESTS_FAILED++))
  ((TESTS_RUN++))
}

# Test 1: TypeScript Build
echo "Test 1: TypeScript Build"
if npm run build --workspace=web > /dev/null 2>&1; then
  pass "TypeScript compilation successful"
else
  fail "TypeScript compilation failed"
fi

# Test 2: Database Schema
echo ""
echo "Test 2: Database Schema Validation"
if psql "$DATABASE_URL" -c "SELECT 1 FROM dead_letter_queue LIMIT 1" > /dev/null 2>&1; then
  pass "dead_letter_queue table exists"
else
  fail "dead_letter_queue table missing"
fi

# Test 3: Admin Login
echo ""
echo "Test 3: Admin Authentication"
ADMIN_TOKEN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | jq -r '.token // empty')

if [ -n "$ADMIN_TOKEN" ]; then
  pass "Admin login successful"
else
  fail "Admin login failed"
  exit 1
fi

# Test 4: Health Check - Live
echo ""
echo "Test 4: Health Check - Live"
LIVE_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/live_response.json -X GET "$API_URL/health/live")
HTTP_CODE="${LIVE_RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
  if cat /tmp/live_response.json | jq -e '.status' > /dev/null 2>&1; then
    pass "Health check live endpoint returns 200"
  else
    fail "Health check live endpoint invalid response"
  fi
else
  fail "Health check live endpoint returned $HTTP_CODE"
fi

# Test 5: Health Check - Ready
echo ""
echo "Test 5: Health Check - Ready"
READY_RESPONSE=$(curl -s -X GET "$API_URL/health/ready")
READY_STATUS=$(echo "$READY_RESPONSE" | jq -r '.status // empty')

if [ "$READY_STATUS" = "healthy" ] || [ "$READY_STATUS" = "unhealthy" ]; then
  if echo "$READY_RESPONSE" | jq -e '.checks' > /dev/null 2>&1; then
    pass "Health check ready endpoint returns valid response"
  else
    fail "Health check ready endpoint missing checks"
  fi
else
  fail "Health check ready endpoint invalid status"
fi

# Test 6: Metrics Endpoint
echo ""
echo "Test 6: Metrics Endpoint"
METRICS_RESPONSE=$(curl -s -X GET "$API_URL/metrics")

if echo "$METRICS_RESPONSE" | grep -q "fmhl_" || echo "$METRICS_RESPONSE" | grep -q "# HELP"; then
  pass "Metrics endpoint returns Prometheus format"
else
  fail "Metrics endpoint invalid format"
fi

# Test 7: Queue Monitoring API
echo ""
echo "Test 7: Queue Monitoring API"
QUEUE_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/queues" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$QUEUE_RESPONSE" | jq -e '.queues' > /dev/null 2>&1; then
  QUEUE_COUNT=$(echo "$QUEUE_RESPONSE" | jq '.queues | length')
  if [ "$QUEUE_COUNT" -gt 0 ]; then
    pass "Queue monitoring API returns queue data"
  else
    fail "Queue monitoring API returns empty queues"
  fi
else
  fail "Queue monitoring API invalid response"
fi

# Test 8: DLQ List API
echo ""
echo "Test 8: DLQ List API"
DLQ_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/queues/dlq?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$DLQ_RESPONSE" | jq -e '.entries' > /dev/null 2>&1; then
  if echo "$DLQ_RESPONSE" | jq -e '.pagination' > /dev/null 2>&1; then
    pass "DLQ list API returns valid response"
  else
    fail "DLQ list API missing pagination"
  fi
else
  fail "DLQ list API invalid response"
fi

# Test 9: Authorization Checks
echo ""
echo "Test 9: Authorization Checks"
UNAUTH_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null -X GET "$API_URL/api/v1/admin/queues")

if [ "$UNAUTH_RESPONSE" = "401" ]; then
  pass "Unauthorized access properly blocked"
else
  fail "Authorization check failed (expected 401, got $UNAUTH_RESPONSE)"
fi

# Test 10: Input Validation
echo ""
echo "Test 10: Input Validation"
INVALID_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/queues/dlq?page=invalid" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$INVALID_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  pass "Input validation working"
else
  fail "Input validation not working"
fi

# Summary
echo ""
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo "Total Tests: $TESTS_RUN"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "❌ Some tests failed"
  exit 1
fi

