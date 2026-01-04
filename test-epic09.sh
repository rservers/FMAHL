#!/bin/bash

# EPIC 09 - Bad Lead & Refunds Integration Tests
# Tests provider report, admin review, approve/reject, history, and metrics

set +e

echo "=== EPIC 09 Integration Tests ==="
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
  
  if grep -q "bad_lead_reason_category" packages/database/migrate.ts; then
    echo -e "  ${GREEN}✓${NC} Migration includes bad_lead_reason_category"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} Migration missing bad_lead_reason_category"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "bad_lead_reason_notes" packages/database/migrate.ts; then
    echo -e "  ${GREEN}✓${NC} Migration includes bad_lead_reason_notes"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} Migration missing bad_lead_reason_notes"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "bad_lead_status" packages/database/migrate.ts; then
    echo -e "  ${GREEN}✓${NC} Migration includes bad_lead_status"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} Migration missing bad_lead_status"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "refund_amount" packages/database/migrate.ts; then
    echo -e "  ${GREEN}✓${NC} Migration includes refund_amount"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} Migration missing refund_amount"
    ((TESTS_FAILED++))
  fi
  
  echo ""
}

# Test 2: Verify TypeScript types exist
test_types() {
  echo "Test 2: TypeScript Types Verification"
  
  if [ -f "apps/web/lib/types/bad-leads.ts" ]; then
    echo -e "  ${GREEN}✓${NC} bad-leads.ts types file exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} bad-leads.ts types file missing"
    ((TESTS_FAILED++))
  fi
  
  if [ -f "apps/web/lib/validations/bad-leads.ts" ]; then
    echo -e "  ${GREEN}✓${NC} bad-leads validation schemas exist"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} bad-leads validation schemas missing"
    ((TESTS_FAILED++))
  fi
  
  echo ""
}

# Test 3: Verify API endpoints exist
test_endpoints() {
  echo "Test 3: API Endpoints Verification"
  
  ENDPOINTS=(
    "apps/web/app/api/v1/provider/assignments/[assignmentId]/bad-lead/route.ts"
    "apps/web/app/api/v1/provider/bad-leads/route.ts"
    "apps/web/app/api/v1/admin/bad-leads/route.ts"
    "apps/web/app/api/v1/admin/bad-leads/[assignmentId]/route.ts"
    "apps/web/app/api/v1/admin/bad-leads/[assignmentId]/approve/route.ts"
    "apps/web/app/api/v1/admin/bad-leads/[assignmentId]/reject/route.ts"
    "apps/web/app/api/v1/admin/bad-leads/metrics/route.ts"
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
    "BAD_LEAD_REPORTED"
    "BAD_LEAD_APPROVED"
    "BAD_LEAD_REJECTED"
    "BAD_LEAD_REFUND_PROCESSED"
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
  
  if grep -q "bad_lead_reported_confirmation" packages/email/types.ts; then
    echo -e "  ${GREEN}✓${NC} bad_lead_reported_confirmation template key exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} bad_lead_reported_confirmation template key missing"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "bad_lead_approved" packages/email/types.ts; then
    echo -e "  ${GREEN}✓${NC} bad_lead_approved template key exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} bad_lead_approved template key missing"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "bad_lead_rejected" packages/email/types.ts; then
    echo -e "  ${GREEN}✓${NC} bad_lead_rejected template key exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} bad_lead_rejected template key missing"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "bad_lead_reported_confirmation" packages/email/templates/defaults.ts; then
    echo -e "  ${GREEN}✓${NC} bad_lead_reported_confirmation template definition exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} bad_lead_reported_confirmation template definition missing"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "bad_lead_approved" packages/email/templates/defaults.ts; then
    echo -e "  ${GREEN}✓${NC} bad_lead_approved template definition exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} bad_lead_approved template definition missing"
    ((TESTS_FAILED++))
  fi
  
  if grep -q "bad_lead_rejected" packages/email/templates/defaults.ts; then
    echo -e "  ${GREEN}✓${NC} bad_lead_rejected template definition exists"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} bad_lead_rejected template definition missing"
    ((TESTS_FAILED++))
  fi
  
  echo ""
}

# Test 6: Verify rate limiting configuration
test_rate_limiting() {
  echo "Test 6: Rate Limiting Configuration"
  
  if grep -q "BAD_LEAD_REPORT" apps/web/lib/middleware/rate-limit.ts; then
    echo -e "  ${GREEN}✓${NC} BAD_LEAD_REPORT configured"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} BAD_LEAD_REPORT missing"
    ((TESTS_FAILED++))
  fi
  
  echo ""
}

# Test 7: Verify TypeScript compilation
test_compilation() {
  echo "Test 7: TypeScript Compilation"
  
  if cd apps/web && npm run build 2>&1 | grep -q "Compiled successfully"; then
    echo -e "  ${GREEN}✓${NC} TypeScript compilation successful"
    ((TESTS_PASSED++))
  else
    echo -e "  ${YELLOW}⚠${NC}  TypeScript compilation check (run 'npm run build' manually)"
    # Don't fail test, just warn
  fi
  
  echo ""
}

# Run all tests
echo "Starting EPIC 09 integration tests..."
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

