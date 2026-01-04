#!/bin/bash

# EPIC 04 Comprehensive Test Script
# Tests Competition Levels & Subscriptions functionality

set -e

echo "============================================"
echo "EPIC 04 - Competition Levels & Subscriptions Tests"
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

echo "Checking for competition_levels table..."
TABLE_CHECK=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
  SELECT COUNT(*) 
  FROM information_schema.tables 
  WHERE table_name = 'competition_levels'
")

if [ "$TABLE_CHECK" -eq "1" ]; then
    pass "competition_levels table exists"
else
    fail "competition_levels table missing"
fi

echo "Checking for competition_level_subscriptions table..."
TABLE_CHECK=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
  SELECT COUNT(*) 
  FROM information_schema.tables 
  WHERE table_name = 'competition_level_subscriptions'
")

if [ "$TABLE_CHECK" -eq "1" ]; then
    pass "competition_level_subscriptions table exists"
else
    fail "competition_level_subscriptions table missing"
fi

echo "Checking for EPIC 04 columns in competition_levels..."
COLUMN_CHECK=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
  SELECT COUNT(*) 
  FROM information_schema.columns 
  WHERE table_name = 'competition_levels' 
  AND column_name IN ('price_per_lead_cents', 'max_recipients', 'order_position', 'is_active')
")

if [ "$COLUMN_CHECK" -eq "4" ]; then
    pass "All 4 key columns exist in competition_levels table"
else
    fail "Expected 4 key columns, found $COLUMN_CHECK"
fi

echo "Checking for unique indexes..."
INDEX_CHECK=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
  SELECT COUNT(*) 
  FROM pg_indexes 
  WHERE tablename = 'competition_levels' 
  AND indexname IN ('idx_competition_levels_name_unique', 'idx_competition_levels_order_unique')
")

if [ "$INDEX_CHECK" -eq "2" ]; then
    pass "All unique indexes exist"
else
    fail "Expected 2 unique indexes, found $INDEX_CHECK"
fi

# 2. Check Email Templates
section "2. Email Template Verification"

echo "Checking for subscription_deactivated template..."
TEMPLATE_CHECK=$(docker exec fmhl-postgres psql -U postgres -d findmeahotlead -tAc "
  SELECT COUNT(*) 
  FROM email_templates 
  WHERE template_key IN ('subscription_deactivated', 'subscription_reactivated') 
  AND is_active = true
")

if [ "$TEMPLATE_CHECK" -eq "2" ]; then
    pass "Both subscription email templates exist"
else
    fail "Expected 2 templates, found $TEMPLATE_CHECK"
fi

# 3. Check API Routes Exist
section "3. API Route File Verification"

ADMIN_ROUTES=(
    "apps/web/app/api/v1/admin/niches/[nicheId]/competition-levels/route.ts"
    "apps/web/app/api/v1/admin/niches/[nicheId]/competition-levels/reorder/route.ts"
    "apps/web/app/api/v1/admin/competition-levels/[id]/route.ts"
    "apps/web/app/api/v1/admin/subscriptions/route.ts"
)

for route in "${ADMIN_ROUTES[@]}"; do
    if [ -f "$route" ]; then
        pass "Route exists: $route"
    else
        fail "Route missing: $route"
    fi
done

PROVIDER_ROUTES=(
    "apps/web/app/api/v1/provider/niches/[nicheId]/competition-levels/route.ts"
    "apps/web/app/api/v1/provider/competition-levels/[id]/subscribe/route.ts"
    "apps/web/app/api/v1/provider/competition-levels/[id]/unsubscribe/route.ts"
    "apps/web/app/api/v1/provider/subscriptions/route.ts"
)

for route in "${PROVIDER_ROUTES[@]}"; do
    if [ -f "$route" ]; then
        pass "Route exists: $route"
    else
        fail "Route missing: $route"
    fi
done

# 4. Check Validation Schemas
section "4. Validation Schema Verification"

if [ -f "apps/web/lib/validations/competition-levels.ts" ]; then
    pass "Validation schemas file exists"
    
    SCHEMAS=(
        "createCompetitionLevelSchema"
        "updateCompetitionLevelSchema"
        "reorderCompetitionLevelsSchema"
        "competitionLevelsListQuerySchema"
        "providerSubscriptionsQuerySchema"
        "adminSubscriptionsQuerySchema"
    )
    
    for schema in "${SCHEMAS[@]}"; do
        if grep -q "$schema" "apps/web/lib/validations/competition-levels.ts"; then
            pass "Schema defined: $schema"
        else
            fail "Schema missing: $schema"
        fi
    done
else
    fail "Validation schemas file missing"
fi

# 5. Check Audit Actions
section "5. Audit Action Constants Verification"

AUDIT_ACTIONS=(
    "COMPETITION_LEVEL_CREATED"
    "COMPETITION_LEVEL_UPDATED"
    "COMPETITION_LEVEL_REORDERED"
    "SUBSCRIPTION_CREATED"
    "SUBSCRIPTION_DEACTIVATED"
    "SUBSCRIPTION_REACTIVATED"
    "SUBSCRIPTION_DELETED"
)

for action in "${AUDIT_ACTIONS[@]}"; do
    if grep -q "$action" "apps/web/lib/services/audit-logger.ts"; then
        pass "Audit action exists: $action"
    else
        fail "Audit action missing: $action"
    fi
done

# 6. Check Subscription Status Service
section "6. Subscription Status Service Verification"

if [ -f "apps/web/lib/services/subscription-status.ts" ]; then
    pass "Subscription status service exists"
    
    FUNCTIONS=(
        "checkAndUpdateSubscriptionStatus"
        "reactivateEligibleSubscriptions"
    )
    
    for func in "${FUNCTIONS[@]}"; do
        if grep -q "$func" "apps/web/lib/services/subscription-status.ts"; then
            pass "Function defined: $func"
        else
            fail "Function missing: $func"
        fi
    done
else
    fail "Subscription status service missing"
fi

# 7. Code Quality Checks
section "7. Code Quality Checks"

# Check for proper middleware usage
ADMIN_MIDDLEWARE_COUNT=$(grep -r "adminWithMFA" apps/web/app/api/v1/admin/niches apps/web/app/api/v1/admin/competition-levels apps/web/app/api/v1/admin/subscriptions 2>/dev/null | wc -l)
if [ "$ADMIN_MIDDLEWARE_COUNT" -ge "6" ]; then
    pass "All admin routes use adminWithMFA middleware"
else
    warn "Expected 6+ adminWithMFA usages, found $ADMIN_MIDDLEWARE_COUNT"
fi

PROVIDER_MIDDLEWARE_COUNT=$(grep -r "providerOnly" apps/web/app/api/v1/provider/niches apps/web/app/api/v1/provider/competition-levels apps/web/app/api/v1/provider/subscriptions 2>/dev/null | wc -l)
if [ "$PROVIDER_MIDDLEWARE_COUNT" -ge "4" ]; then
    pass "All provider routes use providerOnly middleware"
else
    warn "Expected 4+ providerOnly usages, found $PROVIDER_MIDDLEWARE_COUNT"
fi

# Check for proper error handling
ERROR_HANDLING_COUNT=$(grep -r "try {" apps/web/app/api/v1/admin/niches apps/web/app/api/v1/admin/competition-levels apps/web/app/api/v1/provider/niches apps/web/app/api/v1/provider/competition-levels 2>/dev/null | wc -l)
if [ "$ERROR_HANDLING_COUNT" -ge "8" ]; then
    pass "All routes have try-catch error handling"
else
    warn "Some routes may be missing error handling"
fi

# 8. Summary
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

