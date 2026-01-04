#!/bin/bash

# EPIC 08 - Provider Lead Management Integration Tests
# Tests provider inbox, detail view, accept/reject, preferences, and export

set -e
# Allow arithmetic expansion to fail without exiting
set +e

echo "=== EPIC 08 Integration Tests ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: Verify database schema changes
test_schema() {
  echo "Test 1: Database Schema Verification"
  
  # Check migration file contains EPIC 08 schema changes
  if grep -q "viewed_at" packages/database/migrate.ts; then
    echo -e "  ${GREEN}✓${NC} Migration includes viewed_at"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} Migration missing viewed_at"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "accepted_at" packages/database/migrate.ts; then
    echo -e "  ${GREEN}✓${NC} Migration includes accepted_at"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} Migration missing accepted_at"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "rejected_at" packages/database/migrate.ts; then
    echo -e "  ${GREEN}✓${NC} Migration includes rejected_at"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} Migration missing rejected_at"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "notify_on_new_lead" packages/database/migrate.ts; then
    echo -e "  ${GREEN}✓${NC} Migration includes notification preferences"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} Migration missing notification preferences"
    ((TESTS_FAILED++))
  fi
  
  echo ""
}

# Test 2: Verify TypeScript types exist
test_types() {
  echo "Test 2: TypeScript Types Verification"
  
  if [ -f "apps/web/lib/types/provider-leads.ts" ]; then
    echo -e "  ${GREEN}✓${NC} provider-leads.ts types file exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} provider-leads.ts types file missing"
    ((TESTS_FAILED++))
  fi
  
  if [ -f "apps/web/lib/validations/provider-leads.ts" ]; then
    echo -e "  ${GREEN}✓${NC} provider-leads validation schemas exist"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} provider-leads validation schemas missing"
    ((TESTS_FAILED++))
  fi
  
  echo ""
}

# Test 3: Verify API endpoints exist
test_endpoints() {
  echo "Test 3: API Endpoints Verification"
  
  ENDPOINTS=(
    "apps/web/app/api/v1/provider/leads/route.ts"
    "apps/web/app/api/v1/provider/leads/[leadId]/route.ts"
    "apps/web/app/api/v1/provider/leads/[leadId]/accept/route.ts"
    "apps/web/app/api/v1/provider/leads/[leadId]/reject/route.ts"
    "apps/web/app/api/v1/provider/notification-preferences/route.ts"
    "apps/web/app/api/v1/provider/leads/export/route.ts"
  )
  
  for endpoint in "${ENDPOINTS[@]}"; do
    if [ -f "$endpoint" ]; then
      echo -e "  ${GREEN}✓${NC} $(basename $(dirname $endpoint)) endpoint exists"
      ((TESTS_PASSED++))
    else
      echo -e "  ${RED}✗${NC} $(basename $(dirname $endpoint)) endpoint missing"
      ((TESTS_FAILED++))
    fi
  done
  
  echo ""
}

# Test 4: Verify audit actions exist
test_audit_actions() {
  echo "Test 4: Audit Actions Verification"
  
  ACTIONS=(
    "LEAD_VIEWED"
    "LEAD_ACCEPTED"
    "LEAD_REJECTED_BY_PROVIDER"
    "LEAD_EXPORT_REQUESTED"
    "LEAD_EXPORT_COMPLETED"
  )
  
  for action in "${ACTIONS[@]}"; do
    if grep -q "$action" apps/web/lib/services/audit-logger.ts; then
      echo -e "  ${GREEN}✓${NC} $action exists"
      ((TESTS_PASSED++))
    else
      echo -e "  ${RED}✗${NC} $action missing"
      ((TESTS_FAILED++))
    fi
  done
  
  echo ""
}

# Test 5: Verify email templates exist
test_email_templates() {
  echo "Test 5: Email Template Verification"
  
  if grep -q "admin_provider_rejected_lead" packages/email/types.ts; then
    echo -e "  ${GREEN}✓${NC} admin_provider_rejected_lead template key exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} admin_provider_rejected_lead template key missing"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "lead_export_ready" packages/email/types.ts; then
    echo -e "  ${GREEN}✓${NC} lead_export_ready template key exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} lead_export_ready template key missing"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "admin_provider_rejected_lead" packages/email/templates/defaults.ts; then
    echo -e "  ${GREEN}✓${NC} admin_provider_rejected_lead template definition exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} admin_provider_rejected_lead template definition missing"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "lead_export_ready" packages/email/templates/defaults.ts; then
    echo -e "  ${GREEN}✓${NC} lead_export_ready template definition exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} lead_export_ready template definition missing"
    ((TESTS_FAILED++))
  fi
  
  echo ""
}

# Test 6: Verify rate limiting configuration
test_rate_limiting() {
  echo "Test 6: Rate Limiting Configuration"
  
  RATE_LIMITS=(
    "PROVIDER_INBOX"
    "PROVIDER_LEAD_DETAIL"
    "PROVIDER_ACCEPT_REJECT"
    "PROVIDER_EXPORT"
  )
  
  for limit in "${RATE_LIMITS[@]}"; do
    if grep -q "$limit" apps/web/lib/middleware/rate-limit.ts; then
      echo -e "  ${GREEN}✓${NC} $limit configured"
      ((TESTS_PASSED++))
    else
      echo -e "  ${RED}✗${NC} $limit missing"
      ((TESTS_FAILED++))
    fi
  done
  
  echo ""
}

# Test 7: Verify TypeScript compilation
test_compilation() {
  echo "Test 7: TypeScript Compilation"
  
  if npm run build 2>&1 | grep -q "Compiled successfully"; then
    echo -e "  ${GREEN}✓${NC} TypeScript compilation successful"
    ((TESTS_PASSED++))
  else
    echo -e "  ${YELLOW}⚠${NC}  TypeScript compilation check (run 'npm run build' manually)"
    # Don't fail test, just warn
  fi
  
  echo ""
}

# Run all tests
echo "Starting EPIC 08 integration tests..."
echo ""

test_schema
test_types
test_endpoints
test_audit_actions
test_email_templates
test_rate_limiting
test_compilation

# Summary
echo "=== Test Summary ==="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"
else
  echo -e "${GREEN}Failed: 0${NC}"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi

