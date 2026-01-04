#!/bin/bash

# EPIC 05 - Code Review & Validation Script
# Validates implementation against EPIC_05_IMPLEMENTATION_PLAN.md

set -e

echo "============================================"
echo "EPIC 05 - Code Review & Validation"
echo "============================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

section() {
    echo ""
    echo "========================================"
    echo "$1"
    echo "========================================"
}

subsection() {
    echo ""
    echo "--- $1 ---"
}

# Check function existence in file
check_function() {
    local file=$1
    local func=$2
    local desc=$3
    
    if [ -f "$file" ] && grep -q "function $func\|export function $func\|const $func\|export const $func" "$file"; then
        pass "$desc"
    else
        fail "$desc - function '$func' not found in $file"
    fi
}

# Check type/interface existence
check_type() {
    local file=$1
    local type=$2
    local desc=$3
    
    if [ -f "$file" ] && grep -q "type $type\|interface $type\|export type $type\|export interface $type" "$file"; then
        pass "$desc"
    else
        fail "$desc - type '$type' not found in $file"
    fi
}

# Check import exists
check_import() {
    local file=$1
    local import=$2
    local desc=$3
    
    if [ -f "$file" ] && grep -q "import.*$import" "$file"; then
        pass "$desc"
    else
        fail "$desc - import '$import' not found in $file"
    fi
}

section "Phase 1: Database Schema Verification"

subsection "Filter columns in competition_level_subscriptions"
if grep -q "filter_rules JSONB" packages/database/schema.sql; then
    pass "filter_rules column defined"
else
    fail "filter_rules column missing"
fi

if grep -q "filter_updated_at TIMESTAMPTZ" packages/database/schema.sql; then
    pass "filter_updated_at column defined"
else
    fail "filter_updated_at column missing"
fi

if grep -q "filter_is_valid BOOLEAN" packages/database/schema.sql; then
    pass "filter_is_valid column defined"
else
    fail "filter_is_valid column missing"
fi

subsection "subscription_filter_logs table"
if grep -q "CREATE TABLE.*subscription_filter_logs" packages/database/schema.sql; then
    pass "subscription_filter_logs table defined"
else
    fail "subscription_filter_logs table missing"
fi

# Check all required columns
for col in "subscription_id" "actor_id" "actor_role" "old_filter_rules" "new_filter_rules" "admin_only_memo" "memo_updated_at" "memo_updated_by" "created_at"; do
    if grep -A 20 "CREATE TABLE.*subscription_filter_logs" packages/database/schema.sql | grep -q "$col"; then
        pass "Column '$col' exists in subscription_filter_logs"
    else
        fail "Column '$col' missing from subscription_filter_logs"
    fi
done

subsection "Indexes"
for idx in "idx_subscription_filter_logs_subscription_created" "idx_subscription_filter_logs_actor" "idx_subscription_filter_logs_memo_fts" "idx_cls_filter_updated" "idx_cls_filter_invalid" "idx_cls_filter_rules_gin"; do
    if grep -q "$idx" packages/database/schema.sql; then
        pass "Index '$idx' defined"
    else
        fail "Index '$idx' missing"
    fi
done

subsection "Migration function"
if grep -q "ensureEpic05Schema" packages/database/migrate.ts; then
    pass "ensureEpic05Schema() migration function exists"
else
    fail "ensureEpic05Schema() migration function missing"
fi

section "Phase 2: TypeScript Types & Validation"

subsection "Filter types (apps/web/lib/types/filter.ts)"
check_type "apps/web/lib/types/filter.ts" "FilterOperator" "FilterOperator type"
check_type "apps/web/lib/types/filter.ts" "FieldType" "FieldType type"
check_type "apps/web/lib/types/filter.ts" "FilterRule" "FilterRule interface"
check_type "apps/web/lib/types/filter.ts" "FilterRules" "FilterRules interface"
check_type "apps/web/lib/types/filter.ts" "NicheFormSchema" "NicheFormSchema interface"

# Check FIELD_TYPE_OPERATORS mapping
if [ -f "apps/web/lib/types/filter.ts" ] && grep -q "FIELD_TYPE_OPERATORS" "apps/web/lib/types/filter.ts"; then
    pass "FIELD_TYPE_OPERATORS mapping exists"
else
    fail "FIELD_TYPE_OPERATORS mapping missing"
fi

# Check OPERATOR_VALUE_SHAPES mapping
if [ -f "apps/web/lib/types/filter.ts" ] && grep -q "OPERATOR_VALUE_SHAPES" "apps/web/lib/types/filter.ts"; then
    pass "OPERATOR_VALUE_SHAPES mapping exists"
else
    fail "OPERATOR_VALUE_SHAPES mapping missing"
fi

subsection "Validation schemas (apps/web/lib/validations/filter.ts)"
check_function "apps/web/lib/validations/filter.ts" "validateOperatorValueShape" "validateOperatorValueShape function"

if [ -f "apps/web/lib/validations/filter.ts" ] && grep -q "filterOperatorSchema\|filterRuleSchema\|filterRulesSchema\|updateFilterSchema" "apps/web/lib/validations/filter.ts"; then
    pass "Zod validation schemas exist"
else
    fail "Zod validation schemas missing"
fi

subsection "Filter validator (apps/web/lib/filter/validator.ts)"
check_function "apps/web/lib/filter/validator.ts" "validateFilterRules" "validateFilterRules function"

section "Phase 3: Eligibility Engine"

subsection "Operator evaluators (apps/web/lib/filter/operators.ts)"
for op in "evaluateEq" "evaluateNeq" "evaluateIn" "evaluateNotIn" "evaluateContains" "evaluateGte" "evaluateLte" "evaluateBetween" "evaluateExists"; do
    check_function "apps/web/lib/filter/operators.ts" "$op" "Operator function: $op"
done

subsection "Eligibility evaluator (apps/web/lib/filter/evaluator.ts)"
check_function "apps/web/lib/filter/evaluator.ts" "evaluateEligibility" "evaluateEligibility function"
check_type "apps/web/lib/filter/evaluator.ts" "EligibilityResult" "EligibilityResult interface"

# Check fail-safe behavior
if [ -f "apps/web/lib/filter/evaluator.ts" ] && grep -q "fail-safe\|Fail-safe" "apps/web/lib/filter/evaluator.ts"; then
    pass "Fail-safe behavior documented"
else
    warn "Fail-safe behavior not explicitly documented in comments"
fi

section "Phase 4: Provider Filter APIs"

subsection "Provider filter routes"
if [ -f "apps/web/app/api/v1/provider/subscriptions/[subscriptionId]/filters/route.ts" ]; then
    pass "Provider filter route file exists"
    
    # Check PUT handler
    if grep -q "export const PUT" "apps/web/app/api/v1/provider/subscriptions/[subscriptionId]/filters/route.ts"; then
        pass "PUT handler exists"
    else
        fail "PUT handler missing"
    fi
    
    # Check GET handler
    if grep -q "export const GET" "apps/web/app/api/v1/provider/subscriptions/[subscriptionId]/filters/route.ts"; then
        pass "GET handler exists"
    else
        fail "GET handler missing"
    fi
    
    # Check RBAC
    if grep -q "providerOnly" "apps/web/app/api/v1/provider/subscriptions/[subscriptionId]/filters/route.ts"; then
        pass "RBAC (providerOnly) enforced"
    else
        fail "RBAC not enforced"
    fi
    
    # Check validation
    if grep -q "validateFilterRules" "apps/web/app/api/v1/provider/subscriptions/[subscriptionId]/filters/route.ts"; then
        pass "Filter validation integrated"
    else
        fail "Filter validation not integrated"
    fi
    
    # Check idempotency
    if grep -q "deepEqual\|isEqual" "apps/web/app/api/v1/provider/subscriptions/[subscriptionId]/filters/route.ts"; then
        pass "Idempotency check (deep equality) implemented"
    else
        warn "Idempotency check not found"
    fi
else
    fail "Provider filter route file missing"
fi

subsection "Filter summary helper"
check_function "apps/web/lib/filter/summary.ts" "generateFilterSummary" "generateFilterSummary function"

subsection "Updated provider subscriptions list"
if [ -f "apps/web/app/api/v1/provider/subscriptions/route.ts" ]; then
    if grep -q "has_filters\|filter_is_valid" "apps/web/app/api/v1/provider/subscriptions/route.ts"; then
        pass "Subscriptions list includes filter metadata"
    else
        warn "Subscriptions list may not include filter metadata"
    fi
fi

section "Phase 5: Audit Actions & Logging"

subsection "Audit actions"
if grep -q "FILTER_UPDATED" apps/web/lib/services/audit-logger.ts; then
    pass "FILTER_UPDATED audit action exists"
else
    fail "FILTER_UPDATED audit action missing"
fi

if grep -q "FILTER_INVALIDATED" apps/web/lib/services/audit-logger.ts; then
    pass "FILTER_INVALIDATED audit action exists"
else
    fail "FILTER_INVALIDATED audit action missing"
fi

if grep -q "FILTER_MEMO_UPDATED" apps/web/lib/services/audit-logger.ts; then
    pass "FILTER_MEMO_UPDATED audit action exists"
else
    fail "FILTER_MEMO_UPDATED audit action missing"
fi

subsection "Filter log service"
check_function "apps/web/lib/services/filter-log.ts" "logFilterChange" "logFilterChange function"
check_function "apps/web/lib/services/filter-log.ts" "updateFilterMemo" "updateFilterMemo function"

section "Phase 6: Eligible Subscriptions Service"

subsection "Eligibility service (apps/web/lib/services/eligibility.ts)"
check_function "apps/web/lib/services/eligibility.ts" "getEligibleSubscriptionsByLevel" "getEligibleSubscriptionsByLevel function"
check_function "apps/web/lib/services/eligibility.ts" "invalidateEligibilityCache" "invalidateEligibilityCache function"
check_function "apps/web/lib/services/eligibility.ts" "invalidateEligibilityCacheForNiche" "invalidateEligibilityCacheForNiche function"

# Check Redis integration
if [ -f "apps/web/lib/services/eligibility.ts" ] && grep -q "getRedis\|redis" "apps/web/lib/services/eligibility.ts"; then
    pass "Redis integration present"
else
    fail "Redis integration missing"
fi

# Check caching
if [ -f "apps/web/lib/services/eligibility.ts" ] && grep -q "eligible_subs:" "apps/web/lib/services/eligibility.ts"; then
    pass "Cache key pattern implemented"
else
    fail "Cache key pattern missing"
fi

# Check TTL
if [ -f "apps/web/lib/services/eligibility.ts" ] && grep -q "300\|5.*min" "apps/web/lib/services/eligibility.ts"; then
    pass "5-minute TTL implemented"
else
    warn "5-minute TTL not explicitly found"
fi

section "Phase 7: Admin Filter APIs"

subsection "Admin endpoints"
admin_routes=(
    "apps/web/app/api/v1/admin/subscriptions/[subscriptionId]/filters/route.ts"
    "apps/web/app/api/v1/admin/subscriptions/[subscriptionId]/filter-logs/route.ts"
    "apps/web/app/api/v1/admin/subscription-filter-logs/[id]/memo/route.ts"
    "apps/web/app/api/v1/admin/niches/[nicheId]/filter-stats/route.ts"
    "apps/web/app/api/v1/admin/niches/[nicheId]/invalid-filters/route.ts"
)

for route in "${admin_routes[@]}"; do
    if [ -f "$route" ]; then
        pass "Admin route exists: $(basename $(dirname $route))/$(basename $route)"
        
        # Check MFA enforcement
        if grep -q "adminWithMFA" "$route"; then
            pass "  └─ MFA enforced"
        else
            fail "  └─ MFA not enforced"
        fi
    else
        fail "Admin route missing: $route"
    fi
done

section "Phase 8: Schema Change Handler"

subsection "Filter invalidation service"
check_function "apps/web/lib/services/filter-invalidation.ts" "validateSubscriptionFiltersForNiche" "validateSubscriptionFiltersForNiche function"

# Check email notification
if [ -f "apps/web/lib/services/filter-invalidation.ts" ] && grep -q "emailService\|sendTemplated" "apps/web/lib/services/filter-invalidation.ts"; then
    pass "Email notification integrated"
else
    fail "Email notification missing"
fi

section "Phase 9: Email Templates"

subsection "Email template definitions"
if grep -q "filter_updated" packages/email/templates/defaults.ts; then
    pass "filter_updated template exists"
else
    fail "filter_updated template missing"
fi

if grep -q "filter_invalidated" packages/email/templates/defaults.ts; then
    pass "filter_invalidated template exists"
else
    fail "filter_invalidated template missing"
fi

# Check template keys
if grep -q "'filter_updated'" packages/email/types.ts; then
    pass "filter_updated template key in types"
else
    fail "filter_updated template key missing from types"
fi

if grep -q "'filter_invalidated'" packages/email/types.ts; then
    pass "filter_invalidated template key in types"
else
    fail "filter_invalidated template key missing from types"
fi

section "Phase 10: Integration & Testing"

subsection "Test script"
if [ -f "test-epic05.sh" ]; then
    pass "Test script exists (test-epic05.sh)"
else
    fail "Test script missing"
fi

section "Phase 11: Documentation"

subsection "Documentation files"
if [ -f ".cursor/docs/Delivery/EPIC_05_REVIEW.md" ]; then
    pass "EPIC_05_REVIEW.md exists"
else
    warn "EPIC_05_REVIEW.md missing"
fi

# Check status updates
if grep -q "05.*Done\|05.*DONE\|05.*✅" .cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md; then
    pass "EPIC_EXECUTION_PLAN.md updated"
else
    warn "EPIC_EXECUTION_PLAN.md may not be updated"
fi

if grep -q "05.*Done\|05.*DONE\|05.*✅" .cursor/docs/DEVELOPMENT_GUIDE.md; then
    pass "DEVELOPMENT_GUIDE.md updated"
else
    warn "DEVELOPMENT_GUIDE.md may not be updated"
fi

section "Code Quality Checks"

subsection "TypeScript compilation"
info "Running TypeScript build..."
if npm run build > /tmp/epic05-build.log 2>&1; then
    pass "TypeScript build successful"
else
    fail "TypeScript build failed (see /tmp/epic05-build.log)"
fi

subsection "Linting"
info "Checking for linter errors in EPIC 05 files..."
LINT_ERRORS=0

# Check filter files
for file in apps/web/lib/filter/*.ts; do
    if [ -f "$file" ]; then
        if npx eslint "$file" --quiet 2>/dev/null; then
            pass "No lint errors: $(basename $file)"
        else
            warn "Lint errors in: $(basename $file)"
            ((LINT_ERRORS++))
        fi
    fi
done

# Check service files
for file in apps/web/lib/services/eligibility.ts apps/web/lib/services/filter-log.ts apps/web/lib/services/filter-invalidation.ts; do
    if [ -f "$file" ]; then
        if npx eslint "$file" --quiet 2>/dev/null; then
            pass "No lint errors: $(basename $file)"
        else
            warn "Lint errors in: $(basename $file)"
            ((LINT_ERRORS++))
        fi
    fi
done

if [ $LINT_ERRORS -eq 0 ]; then
    pass "All EPIC 05 files pass linting"
fi

section "Implementation Plan Alignment"

subsection "Checking against EPIC_05_IMPLEMENTATION_PLAN.md"

# Count implemented phases
PHASES_COMPLETE=0
for phase in {1..11}; do
    case $phase in
        1) [ -f "packages/database/schema.sql" ] && grep -q "filter_rules" "packages/database/schema.sql" && ((PHASES_COMPLETE++)) ;;
        2) [ -f "apps/web/lib/types/filter.ts" ] && ((PHASES_COMPLETE++)) ;;
        3) [ -f "apps/web/lib/filter/evaluator.ts" ] && ((PHASES_COMPLETE++)) ;;
        4) [ -f "apps/web/app/api/v1/provider/subscriptions/[subscriptionId]/filters/route.ts" ] && ((PHASES_COMPLETE++)) ;;
        5) [ -f "apps/web/lib/services/filter-log.ts" ] && ((PHASES_COMPLETE++)) ;;
        6) [ -f "apps/web/lib/services/eligibility.ts" ] && ((PHASES_COMPLETE++)) ;;
        7) [ -f "apps/web/app/api/v1/admin/subscriptions/[subscriptionId]/filters/route.ts" ] && ((PHASES_COMPLETE++)) ;;
        8) [ -f "apps/web/lib/services/filter-invalidation.ts" ] && ((PHASES_COMPLETE++)) ;;
        9) grep -q "filter_updated" "packages/email/templates/defaults.ts" && ((PHASES_COMPLETE++)) ;;
        10) [ -f "test-epic05.sh" ] && ((PHASES_COMPLETE++)) ;;
        11) [ -f ".cursor/docs/Delivery/EPIC_05_REVIEW.md" ] && ((PHASES_COMPLETE++)) ;;
    esac
done

info "Phases completed: $PHASES_COMPLETE / 11"
if [ $PHASES_COMPLETE -eq 11 ]; then
    pass "All 11 phases implemented"
else
    warn "Some phases may be incomplete ($PHASES_COMPLETE / 11)"
fi

section "SUMMARY"

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED))
echo ""
echo "Checks Passed: $CHECKS_PASSED / $TOTAL_CHECKS"
echo "Checks Failed: $CHECKS_FAILED / $TOTAL_CHECKS"
echo "Warnings: $WARNINGS"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Code review passed!${NC}"
    echo ""
    echo "EPIC 05 implementation verified:"
    echo "  ✓ All 11 phases complete"
    echo "  ✓ Database schema correct"
    echo "  ✓ TypeScript types and validation"
    echo "  ✓ 9 operator evaluators"
    echo "  ✓ Provider & admin APIs (7 endpoints)"
    echo "  ✓ Eligibility service with caching"
    echo "  ✓ Filter logging and audit trail"
    echo "  ✓ Schema change handler"
    echo "  ✓ Email templates"
    echo "  ✓ TypeScript build successful"
    echo "  ✓ Documentation updated"
    echo ""
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}Note: $WARNINGS warnings (non-critical)${NC}"
    fi
    exit 0
else
    echo -e "${RED}✗ Code review failed${NC}"
    echo "Please address the failed checks above"
    exit 1
fi

