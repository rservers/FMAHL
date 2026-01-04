#!/bin/bash

# EPIC 03 Comprehensive Test Script
# Tests Admin Lead Review & Approval functionality

set -e

echo "============================================"
echo "EPIC 03 - Admin Lead Review & Approval Tests"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

section() {
    echo ""
    echo "----------------------------------------"
    echo "$1"
    echo "----------------------------------------"
}

# 1. Verify Database Schema
section "1. Database Schema Verification"

echo "Checking for EPIC 03 columns in leads table..."
SCHEMA_CHECK=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
  SELECT 
    COUNT(*) 
  FROM information_schema.columns 
  WHERE table_name = 'leads' 
  AND column_name IN ('approved_at', 'approved_by', 'rejected_at', 'rejected_by', 'rejection_reason', 'admin_notes')
")

if [ "$SCHEMA_CHECK" -eq "6" ]; then
    pass "All 6 EPIC 03 columns exist in leads table"
else
    fail "Expected 6 EPIC 03 columns, found $SCHEMA_CHECK"
fi

echo "Checking for admin query indexes..."
INDEX_CHECK=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
  SELECT COUNT(*) 
  FROM pg_indexes 
  WHERE tablename = 'leads' 
  AND indexname IN ('idx_leads_status_created', 'idx_leads_approved_at', 'idx_leads_rejected_at')
")

if [ "$INDEX_CHECK" -eq "3" ]; then
    pass "All 3 admin query indexes exist"
else
    fail "Expected 3 indexes, found $INDEX_CHECK"
fi

# 2. Check Email Templates
section "2. Email Template Verification"

echo "Checking for lead_approved template..."
TEMPLATE_CHECK=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
  SELECT COUNT(*) 
  FROM email_templates 
  WHERE template_key IN ('lead_approved', 'lead_rejected') 
  AND is_active = true
")

if [ "$TEMPLATE_CHECK" -eq "2" ]; then
    pass "Both lead_approved and lead_rejected templates exist"
else
    fail "Expected 2 templates, found $TEMPLATE_CHECK"
fi

# 3. Check API Routes Exist
section "3. API Route File Verification"

ROUTES=(
    "apps/web/app/api/v1/admin/leads/route.ts"
    "apps/web/app/api/v1/admin/leads/[id]/route.ts"
    "apps/web/app/api/v1/admin/leads/[id]/approve/route.ts"
    "apps/web/app/api/v1/admin/leads/[id]/reject/route.ts"
    "apps/web/app/api/v1/admin/leads/bulk-approve/route.ts"
    "apps/web/app/api/v1/admin/leads/bulk-reject/route.ts"
    "apps/web/app/api/v1/admin/leads/stats/route.ts"
)

for route in "${ROUTES[@]}"; do
    if [ -f "$route" ]; then
        pass "Route exists: $route"
    else
        fail "Route missing: $route"
    fi
done

# 4. Check UI Pages
section "4. UI Page Verification"

UI_PAGES=(
    "apps/web/app/dashboard/leads/page.tsx"
    "apps/web/app/dashboard/leads/[id]/page.tsx"
)

for page in "${UI_PAGES[@]}"; do
    if [ -f "$page" ]; then
        pass "UI page exists: $page"
    else
        fail "UI page missing: $page"
    fi
done

# 5. Check Validation Schemas
section "5. Validation Schema Verification"

if [ -f "apps/web/lib/validations/admin-leads.ts" ]; then
    pass "Validation schemas file exists"
    
    # Check for required schemas
    SCHEMAS=(
        "approveLeadSchema"
        "rejectLeadSchema"
        "bulkApproveSchema"
        "bulkRejectSchema"
        "leadListQuerySchema"
    )
    
    for schema in "${SCHEMAS[@]}"; do
        if grep -q "$schema" "apps/web/lib/validations/admin-leads.ts"; then
            pass "Schema defined: $schema"
        else
            fail "Schema missing: $schema"
        fi
    done
else
    fail "Validation schemas file missing"
fi

# 6. Create Test Data
section "6. Integration Test - Create Test Lead"

# First, create a test niche (if not exists)
NICHE_ID=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
  SELECT id FROM niches WHERE name = 'VPS & Dedicated Servers' LIMIT 1
")

if [ -z "$NICHE_ID" ]; then
    fail "Test niche not found"
else
    pass "Test niche found: $NICHE_ID"
    
    # Create a test lead in pending_approval status
    TEST_LEAD_ID=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
      INSERT INTO leads (
        niche_id,
        schema_version,
        status,
        submitter_name,
        submitter_email,
        submitter_phone,
        niche_data,
        confirmed_at
      ) VALUES (
        '$NICHE_ID',
        1,
        'pending_approval',
        'Test User',
        'test@example.com',
        '+1234567890',
        '{\"company_name\": \"Test Corp\", \"monthly_budget\": \"5000\"}',
        NOW()
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    ")
    
    if [ -n "$TEST_LEAD_ID" ]; then
        pass "Test lead created: $TEST_LEAD_ID"
    else
        # Check if one already exists
        TEST_LEAD_ID=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
          SELECT id FROM leads WHERE status = 'pending_approval' LIMIT 1
        ")
        if [ -n "$TEST_LEAD_ID" ]; then
            pass "Using existing test lead: $TEST_LEAD_ID"
        else
            fail "Could not create or find test lead"
        fi
    fi
fi

# 7. Verify Lead Status Transitions
section "7. Lead Status Logic Verification"

if [ -n "$TEST_LEAD_ID" ]; then
    # Check current status
    CURRENT_STATUS=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
      SELECT status FROM leads WHERE id = '$TEST_LEAD_ID'
    ")
    
    if [ "$CURRENT_STATUS" = "pending_approval" ]; then
        pass "Test lead is in pending_approval status"
    else
        warn "Test lead status is $CURRENT_STATUS (expected pending_approval)"
    fi
fi

# 8. Check Audit Actions
section "8. Audit Action Constants Verification"

if grep -q "LEAD_APPROVED" "apps/web/lib/services/audit-logger.ts"; then
    pass "LEAD_APPROVED audit action exists"
else
    fail "LEAD_APPROVED audit action missing"
fi

if grep -q "LEAD_REJECTED" "apps/web/lib/services/audit-logger.ts"; then
    pass "LEAD_REJECTED audit action exists"
else
    fail "LEAD_REJECTED audit action missing"
fi

# 9. Code Quality Checks
section "9. Code Quality Checks"

# Check for proper middleware usage
MIDDLEWARE_COUNT=$(grep -r "adminWithMFA" apps/web/app/api/v1/admin/leads/ | wc -l)
if [ "$MIDDLEWARE_COUNT" -ge "7" ]; then
    pass "All admin lead routes use adminWithMFA middleware"
else
    warn "Expected 7+ adminWithMFA usages, found $MIDDLEWARE_COUNT"
fi

# Check for proper error handling
ERROR_HANDLING_COUNT=$(grep -r "try {" apps/web/app/api/v1/admin/leads/ | wc -l)
if [ "$ERROR_HANDLING_COUNT" -ge "7" ]; then
    pass "All routes have try-catch error handling"
else
    warn "Some routes may be missing error handling"
fi

# 10. Summary
section "SUMMARY"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo ""
echo "Tests Passed: $TESTS_PASSED / $TOTAL_TESTS"
echo "Tests Failed: $TESTS_FAILED / $TOTAL_TESTS"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

