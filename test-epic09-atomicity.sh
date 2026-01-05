#!/bin/bash

# EPIC 09 - Atomicity & Transaction Safety Validation
# Validates that the refund process is truly atomic

set +e

echo "=== EPIC 09 Atomicity Validation ==="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

echo "Test 1: Verify Single Transaction Block"
echo "  Checking admin approve endpoint uses single sql.begin()..."

# Count sql.begin calls in approve endpoint
BEGIN_COUNT=$(grep -c "sql\.begin" apps/web/app/api/v1/admin/bad-leads/[assignmentId]/approve/route.ts)

if [ "$BEGIN_COUNT" -eq 1 ]; then
  echo -e "  ${GREEN}✓${NC} Single transaction block found"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗${NC} Multiple or no transaction blocks found: $BEGIN_COUNT"
  ((TESTS_FAILED++))
fi

echo ""
echo "Test 2: Verify No Nested createLedgerEntry Call"
echo "  Checking approve endpoint doesn't call createLedgerEntry..."

if ! grep -q "createLedgerEntry" apps/web/app/api/v1/admin/bad-leads/[assignmentId]/approve/route.ts; then
  echo -e "  ${GREEN}✓${NC} No createLedgerEntry call (inlined)"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗${NC} createLedgerEntry call found (nested transaction risk)"
  ((TESTS_FAILED++))
fi

echo ""
echo "Test 3: Verify No Nested checkAndUpdateSubscriptionStatus Call"
echo "  Checking approve endpoint doesn't call checkAndUpdateSubscriptionStatus..."

if ! grep -q "checkAndUpdateSubscriptionStatus" apps/web/app/api/v1/admin/bad-leads/[assignmentId]/approve/route.ts; then
  echo -e "  ${GREEN}✓${NC} No checkAndUpdateSubscriptionStatus call (inlined)"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗${NC} checkAndUpdateSubscriptionStatus call found (separate transaction risk)"
  ((TESTS_FAILED++))
fi

echo ""
echo "Test 4: Verify Row-Level Locking on Provider"
echo "  Checking FOR UPDATE lock on provider balance..."

if grep -q "SELECT balance FROM providers.*FOR UPDATE" apps/web/app/api/v1/admin/bad-leads/[assignmentId]/approve/route.ts; then
  echo -e "  ${GREEN}✓${NC} Provider row locked with FOR UPDATE"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗${NC} No FOR UPDATE lock on provider (race condition risk)"
  ((TESTS_FAILED++))
fi

echo ""
echo "Test 5: Verify Ledger Entry Within Transaction"
echo "  Checking INSERT INTO provider_ledger uses transaction parameter..."

if grep -B 2 "INSERT INTO provider_ledger" apps/web/app/api/v1/admin/bad-leads/[assignmentId]/approve/route.ts | grep -q "txn\`"; then
  echo -e "  ${GREEN}✓${NC} Ledger entry uses transaction parameter"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗${NC} Ledger entry may not use transaction parameter"
  ((TESTS_FAILED++))
fi

echo ""
echo "Test 6: Verify Balance Update Within Transaction"
echo "  Checking UPDATE providers SET balance uses transaction parameter..."

if grep -B 2 "UPDATE providers" apps/web/app/api/v1/admin/bad-leads/[assignmentId]/approve/route.ts | grep -q "txn\`"; then
  echo -e "  ${GREEN}✓${NC} Balance update uses transaction parameter"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗${NC} Balance update may not use transaction parameter"
  ((TESTS_FAILED++))
fi

echo ""
echo "Test 7: Verify Assignment Update Within Transaction"
echo "  Checking UPDATE lead_assignments uses transaction parameter..."

if grep -B 2 "UPDATE lead_assignments" apps/web/app/api/v1/admin/bad-leads/[assignmentId]/approve/route.ts | grep -q "txn\`"; then
  echo -e "  ${GREEN}✓${NC} Assignment update uses transaction parameter"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗${NC} Assignment update may not use transaction parameter"
  ((TESTS_FAILED++))
fi

echo ""
echo "Test 8: Verify Subscription Update Within Transaction"
echo "  Checking UPDATE competition_level_subscriptions uses transaction parameter..."

if grep -B 2 "UPDATE competition_level_subscriptions" apps/web/app/api/v1/admin/bad-leads/[assignmentId]/approve/route.ts | grep -q "txn\`"; then
  echo -e "  ${GREEN}✓${NC} Subscription update uses transaction parameter"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗${NC} Subscription update may not use transaction parameter"
  ((TESTS_FAILED++))
fi

echo ""
echo "Test 9: Verify Provider Report Uses Transaction"
echo "  Checking provider report endpoint uses sql.begin()..."

if grep -q "sql\.begin" apps/web/app/api/v1/provider/assignments/[assignmentId]/bad-lead/route.ts; then
  echo -e "  ${GREEN}✓${NC} Provider report uses transaction"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗${NC} Provider report doesn't use transaction"
  ((TESTS_FAILED++))
fi

echo ""
echo "Test 10: Verify Admin Reject Uses Transaction"
echo "  Checking admin reject endpoint uses sql.begin()..."

if grep -q "sql\.begin" apps/web/app/api/v1/admin/bad-leads/[assignmentId]/reject/route.ts; then
  echo -e "  ${GREEN}✓${NC} Admin reject uses transaction"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗${NC} Admin reject doesn't use transaction"
  ((TESTS_FAILED++))
fi

echo ""
echo "=== Atomicity Test Summary ==="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"
else
  echo -e "${GREEN}Failed: 0${NC}"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All atomicity tests passed!${NC}"
  echo "Refund processing is properly atomic and safe."
  exit 0
else
  echo -e "${RED}❌ Some atomicity tests failed${NC}"
  echo "Transaction safety may be compromised."
  exit 1
fi

