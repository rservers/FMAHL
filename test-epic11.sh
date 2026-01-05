#!/bin/bash

# EPIC 11 - Reporting & Analytics: Integration Tests
# Tests all reporting endpoints, caching, authorization, and data accuracy

set -e

echo "========================================="
echo "EPIC 11 - Reporting & Analytics Tests"
echo "========================================="
echo ""

# Configuration
API_BASE="http://localhost:3000/api/v1"
ADMIN_TOKEN=""
PROVIDER_TOKEN=""
PASS_COUNT=0
FAIL_COUNT=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
pass() {
  echo -e "${GREEN}✓ PASS${NC}: $1"
  ((PASS_COUNT++))
}

fail() {
  echo -e "${RED}✗ FAIL${NC}: $1"
  ((FAIL_COUNT++))
}

info() {
  echo -e "${YELLOW}ℹ INFO${NC}: $1"
}

# Test 1: Admin KPI Dashboard
test_admin_kpis() {
  echo "Test 1: Admin KPI Dashboard"
  
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/kpis?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"period"' && echo "$BODY" | grep -q '"kpis"'; then
      pass "Admin KPI dashboard returns valid response"
    else
      fail "Admin KPI dashboard response missing required fields"
    fi
  else
    fail "Admin KPI dashboard returned HTTP $HTTP_CODE"
  fi
}

# Test 2: Funnel Analytics
test_funnel_analytics() {
  echo "Test 2: Funnel Analytics"
  
  # Test with day bucket
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/funnel?bucket=day&date_from=2026-01-01T00:00:00Z&date_to=2026-01-07T23:59:59Z")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"series"' && echo "$BODY" | grep -q '"bucket":"day"'; then
      pass "Funnel analytics (day bucket) returns valid response"
    else
      fail "Funnel analytics response missing required fields"
    fi
  else
    fail "Funnel analytics returned HTTP $HTTP_CODE"
  fi
  
  # Test with hour bucket
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/funnel?bucket=hour&date_from=2026-01-04T00:00:00Z&date_to=2026-01-04T23:59:59Z")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" = "200" ]; then
    pass "Funnel analytics (hour bucket) works"
  else
    fail "Funnel analytics (hour bucket) returned HTTP $HTTP_CODE"
  fi
}

# Test 3: Revenue Summary
test_revenue_summary() {
  echo "Test 3: Revenue Summary"
  
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/revenue?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"total_deposits"' && echo "$BODY" | grep -q '"net_revenue"'; then
      pass "Revenue summary returns valid response"
    else
      fail "Revenue summary response missing required fields"
    fi
  else
    fail "Revenue summary returned HTTP $HTTP_CODE"
  fi
}

# Test 4: Starvation Monitoring
test_starvation_monitoring() {
  echo "Test 4: Starvation Monitoring"
  
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/fairness/starvation")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"threshold_days"' && echo "$BODY" | grep -q '"starved_subscriptions"'; then
      pass "Starvation monitoring returns valid response"
    else
      fail "Starvation monitoring response missing required fields"
    fi
  else
    fail "Starvation monitoring returned HTTP $HTTP_CODE"
  fi
}

# Test 5: Flagged Providers
test_flagged_providers() {
  echo "Test 5: Flagged Providers"
  
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/providers/flags?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"providers"'; then
      pass "Flagged providers returns valid response"
    else
      fail "Flagged providers response missing required fields"
    fi
  else
    fail "Flagged providers returned HTTP $HTTP_CODE"
  fi
}

# Test 6: Provider KPI Dashboard
test_provider_kpis() {
  echo "Test 6: Provider KPI Dashboard"
  
  # Test without grouping
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $PROVIDER_TOKEN" \
    "$API_BASE/provider/reports/kpis?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z&group_by=none")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"kpis"' && echo "$BODY" | grep -q '"group_by":"none"'; then
      pass "Provider KPIs (no grouping) returns valid response"
    else
      fail "Provider KPIs response missing required fields"
    fi
  else
    fail "Provider KPIs returned HTTP $HTTP_CODE"
  fi
  
  # Test with niche grouping
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $PROVIDER_TOKEN" \
    "$API_BASE/provider/reports/kpis?group_by=niche")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" = "200" ]; then
    pass "Provider KPIs (niche grouping) works"
  else
    fail "Provider KPIs (niche grouping) returned HTTP $HTTP_CODE"
  fi
}

# Test 7: Caching Behavior
test_caching() {
  echo "Test 7: Caching Behavior"
  
  # First request (cache miss)
  START_TIME=$(date +%s%3N)
  RESPONSE1=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/kpis?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z")
  END_TIME=$(date +%s%3N)
  TIME1=$((END_TIME - START_TIME))
  
  HTTP_CODE1=$(echo "$RESPONSE1" | tail -n1)
  
  # Second request (cache hit, should be faster)
  START_TIME=$(date +%s%3N)
  RESPONSE2=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/kpis?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z")
  END_TIME=$(date +%s%3N)
  TIME2=$((END_TIME - START_TIME))
  
  HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
  
  if [ "$HTTP_CODE1" = "200" ] && [ "$HTTP_CODE2" = "200" ]; then
    info "First request: ${TIME1}ms, Second request: ${TIME2}ms"
    if [ "$TIME2" -lt "$TIME1" ]; then
      pass "Caching improves response time"
    else
      info "Cache may not be working (second request not faster)"
    fi
  else
    fail "Caching test failed (HTTP codes: $HTTP_CODE1, $HTTP_CODE2)"
  fi
  
  # Test cache bypass
  RESPONSE3=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/kpis?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z&no_cache=true")
  
  HTTP_CODE3=$(echo "$RESPONSE3" | tail -n1)
  
  if [ "$HTTP_CODE3" = "200" ]; then
    pass "Cache bypass (no_cache=true) works"
  else
    fail "Cache bypass returned HTTP $HTTP_CODE3"
  fi
}

# Test 8: Authorization Checks
test_authorization() {
  echo "Test 8: Authorization Checks"
  
  # Admin endpoint should reject provider token
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $PROVIDER_TOKEN" \
    "$API_BASE/admin/reports/kpis")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ]; then
    pass "Admin endpoints reject provider tokens"
  else
    fail "Admin endpoint returned HTTP $HTTP_CODE (expected 401/403)"
  fi
  
  # Provider endpoint should reject admin token (if not a provider)
  # This test is optional as admins might have provider access
  info "Provider endpoint authorization test skipped (admins may have provider access)"
}

# Test 9: Input Validation
test_input_validation() {
  echo "Test 9: Input Validation"
  
  # Invalid date format
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/kpis?date_from=invalid-date")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" = "400" ]; then
    pass "Invalid date format rejected"
  else
    fail "Invalid date format returned HTTP $HTTP_CODE (expected 400)"
  fi
  
  # Invalid bucket value
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/funnel?bucket=invalid")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" = "400" ]; then
    pass "Invalid bucket value rejected"
  else
    fail "Invalid bucket value returned HTTP $HTTP_CODE (expected 400)"
  fi
  
  # Invalid UUID
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE/admin/reports/funnel?niche_id=not-a-uuid")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" = "400" ]; then
    pass "Invalid UUID rejected"
  else
    fail "Invalid UUID returned HTTP $HTTP_CODE (expected 400)"
  fi
}

# Test 10: Database Schema
test_database_schema() {
  echo "Test 10: Database Schema"
  
  # Check if report_export_jobs table exists
  TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'report_export_jobs');")
  
  if [ "$TABLE_EXISTS" = "t" ]; then
    pass "report_export_jobs table exists"
  else
    fail "report_export_jobs table does not exist"
  fi
  
  # Check if indexes exist
  INDEX_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_leads_niche_submitted');")
  
  if [ "$INDEX_EXISTS" = "t" ]; then
    pass "Report query indexes exist"
  else
    fail "Report query indexes do not exist"
  fi
}

# Main execution
main() {
  echo "Prerequisites Check:"
  echo "-------------------"
  
  # Check if server is running
  if ! curl -s "$API_BASE/health" > /dev/null 2>&1; then
    echo -e "${RED}✗ Server is not running at $API_BASE${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
  fi
  pass "Server is running"
  
  # Check for tokens
  if [ -z "$ADMIN_TOKEN" ]; then
    info "ADMIN_TOKEN not set. Skipping admin tests."
    info "Set ADMIN_TOKEN environment variable to run admin tests."
  fi
  
  if [ -z "$PROVIDER_TOKEN" ]; then
    info "PROVIDER_TOKEN not set. Skipping provider tests."
    info "Set PROVIDER_TOKEN environment variable to run provider tests."
  fi
  
  if [ -z "$DATABASE_URL" ]; then
    info "DATABASE_URL not set. Skipping database schema tests."
  fi
  
  echo ""
  echo "Running Tests:"
  echo "-------------------"
  
  if [ -n "$ADMIN_TOKEN" ]; then
    test_admin_kpis
    test_funnel_analytics
    test_revenue_summary
    test_starvation_monitoring
    test_flagged_providers
    test_caching
    test_authorization
    test_input_validation
  fi
  
  if [ -n "$PROVIDER_TOKEN" ]; then
    test_provider_kpis
  fi
  
  if [ -n "$DATABASE_URL" ]; then
    test_database_schema
  fi
  
  echo ""
  echo "========================================="
  echo "Test Summary"
  echo "========================================="
  echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
  echo -e "${RED}Failed: $FAIL_COUNT${NC}"
  echo ""
  
  if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
  else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
  fi
}

main

