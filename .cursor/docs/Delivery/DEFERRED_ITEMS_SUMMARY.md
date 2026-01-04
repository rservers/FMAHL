# Deferred Items - Master Tracker

**Last Updated:** Jan 4, 2026  
**Status:** Active

---

## Overview

This document tracks all deferred items identified during epic reviews. Each item is assigned to a target epic with priority and effort estimates.

---

## Legend

**Priority:**
- P1: Critical for MVP
- P2: Important for production
- P3: Nice to have, can wait

**Status:**
- 🔴 Not Started
- 🟡 In Progress
- 🟢 Complete

---

## From EPIC 01 (Platform Foundation)

### ✅ COMPLETE
- ✅ **Rate limiting for EPIC 04 routes** - Completed Jan 4, 2026

---

## From EPIC 03 (Admin Lead Review)

### 1. Caching for Stats Endpoint (P3)
**Target Epic:** EPIC 11 - Reporting & Analytics  
**Status:** 🔴 Not Started  
**Effort:** 2 hours

**Context:** The queue stats endpoint (`GET /api/v1/admin/leads/queue/stats`) performs several COUNT queries that could benefit from caching.

**Recommendation:**
- Cache stats with 1-minute TTL
- Invalidate cache on approve/reject actions
- Use Redis for cache storage

**Expected Impact:**
- Reduce database load by ~80% for stats queries
- Improve response time from ~50ms to ~2ms

---

### 2. Advanced Lead Filtering (P3)
**Target Epic:** EPIC 11 - Reporting & Analytics  
**Status:** 🔴 Not Started  
**Effort:** 4 hours

**Context:** Current lead queue supports basic filters (status, niche). Admin users need more advanced filtering for efficient lead management.

**Recommendation:**
- Date range filters (created_at, confirmed_at, approved_at)
- Search by email (contact_email, submitter_email)
- Filter by admin (approved_by_admin_id, rejected_by_admin_id)
- Multi-niche filter
- Sort by multiple columns

**Implementation:**
- Extend `adminLeadsQueueQuerySchema` in `apps/web/lib/validations/lead.ts`
- Add query parameters to queue API
- Create database indexes for new filter columns
- Update admin UI with filter controls

---

### 3. CSV Export of Leads (P3)
**Target Epic:** EPIC 11 - Reporting & Analytics  
**Status:** 🔴 Not Started  
**Effort:** 3 hours

**Context:** Admins need to export lead data for external analysis, reporting, and compliance.

**Recommendation:**
- Add `GET /api/v1/admin/leads/export` endpoint
- Support CSV format (Excel-compatible)
- Apply same filters as queue endpoint
- Stream large exports (prevent memory issues)
- Include all lead fields + niche name + admin actions

**Implementation:**
- Use `csv-stringify` or similar library
- Set appropriate headers (`Content-Type: text/csv`)
- Limit to 10,000 leads per export
- Add audit log for exports (`lead.exported`)

---

### 4. Rate Limiting for Admin Lead Routes (P2)
**Target Epic:** EPIC 01 - Platform Foundation  
**Status:** 🔴 Not Started  
**Effort:** 2 hours

**Context:** Admin lead review routes don't have endpoint-specific rate limiting. While global auth rate limiting exists (100 req/min), specific limits would prevent abuse.

**Recommendation:**
- Admin approve/reject: 100 req/min
- Admin bulk operations: 30 req/min (more expensive)
- Admin lead detail: 200 req/min (read-heavy)

**Routes:**
- `PATCH /api/v1/admin/leads/:id/approve`
- `PATCH /api/v1/admin/leads/:id/reject`
- `POST /api/v1/admin/leads/bulk-approve`
- `POST /api/v1/admin/leads/bulk-reject`
- `GET /api/v1/admin/leads/:id`
- `GET /api/v1/admin/leads/queue`
- `GET /api/v1/admin/leads/queue/stats`

---

### 5. Batch Scheduling (Out of MVP Scope)
**Target Epic:** Future (post-MVP)  
**Status:** 🔴 Not Started  
**Effort:** 8 hours

**Context:** Admins may want to schedule bulk approvals for off-peak hours or specific times.

**Recommendation:**
- Defer to post-MVP
- Would require job scheduling system (BullMQ, cron)
- Lower priority than other items

---

### 6. Webhooks for External Systems (Out of MVP Scope)
**Target Epic:** Future (post-MVP)  
**Status:** 🔴 Not Started  
**Effort:** 12 hours

**Context:** External CRM systems may want to be notified when leads are approved/rejected.

**Recommendation:**
- Defer to post-MVP
- Would require webhook infrastructure
- Lower priority for initial launch

---

## From EPIC 10 (Email Infrastructure)

### 1. Email Queue Monitoring (P2)
**Target Epic:** EPIC 12 - Observability & Ops  
**Status:** 🔴 Not Started  
**Effort:** 4 hours

**Context:** The email queue (BullMQ) needs monitoring for production operations. Admins should be alerted to queue depth, failures, and delays.

**Recommendation:**
- **Queue depth monitoring:** Alert if >1000 emails queued
- **DLQ monitoring:** Alert if dead letter queue has >10 emails
- **Send rate tracking:** Track emails/minute for SES limit compliance
- **Failed job alerts:** Alert on repeated failures for same email

**Implementation:**
- Expose BullMQ metrics endpoint
- Integrate with Prometheus/Grafana (EPIC 12)
- Add alerting rules
- Create dashboard for email operations

---

### 2. Template Management UI (P3)
**Target Epic:** EPIC 11 - Reporting & Analytics (or Future)  
**Status:** 🔴 Not Started  
**Effort:** 8 hours

**Context:** Email templates are currently managed via database seeds and code. Admins need a UI to edit templates without code deployments.

**Recommendation:**
- Admin UI for template CRUD
- WYSIWYG editor or Handlebars syntax highlighting
- Template preview with sample data
- Version history tracking
- Test send functionality

**Implementation:**
- Extend admin APIs (already have GET/POST/PATCH/DELETE)
- Create admin UI pages:
  - `app/(admin)/admin/email-templates/page.tsx` - List templates
  - `app/(admin)/admin/email-templates/[id]/page.tsx` - Edit template
  - `app/(admin)/admin/email-templates/[id]/preview/page.tsx` - Preview
- Add rich text editor component
- Implement version history in database

**Note:** Admin APIs already exist from EPIC 10. Only UI needs to be built.

---

### 3. Production SES Configuration (Deployment Task)
**Target Epic:** N/A - Deployment checklist  
**Status:** 🔴 Not Started  
**Effort:** 2 hours (ops work)

**Context:** SES is currently in sandbox mode (MailHog for local). Production requires proper SES setup.

**Tasks:**
- Verify domain in AWS SES
- Move out of sandbox mode
- Set up SNS topic for bounces/complaints
- Configure webhook endpoint
- Set environment variables

**Documentation:** Already covered in README.md deployment section.

---

## From EPIC 04 (Competition Levels & Subscriptions)

### ✅ COMPLETE
- ✅ **Rate limiting for competition level routes** - Completed Jan 4, 2026

### 1. Redis Caching for Competition Levels (P3)
**Target Epic:** EPIC 11 - Reporting & Analytics  
**Status:** 🔴 Not Started  
**Effort:** 4 hours

**Context:** Competition levels are frequently read but rarely changed. Caching would significantly reduce database load.

**Recommendation:**
- Cache competition levels by niche_id (TTL: 1 hour)
- Cache provider subscriptions by provider_id (TTL: 5 minutes)
- Cache email templates by template_key (TTL: 6 hours)

**Expected Impact:**
- Reduce database load by ~60% for read operations
- Improve response time from ~20ms to ~2ms

**Implementation:**
- Create `apps/web/lib/services/competition-levels.ts` service layer
- Implement cache-aside pattern
- Invalidate cache on CRUD operations
- Use Redis with `ioredis` client

---

### 2. Scheduled Job for Subscription Reactivation (P3)
**Target Epic:** EPIC 12 - Observability & Ops  
**Status:** 🔴 Not Started  
**Effort:** 2 hours

**Context:** The `subscription-status.ts` service includes a `reactivateEligibleSubscriptions()` function designed to be called periodically.

**Recommendation:**
- Implement cron job in `apps/worker` service
- Schedule: Every 5 minutes
- Call `reactivateEligibleSubscriptions()`
- Monitor for success/failure
- Track execution duration

**Implementation:**
- Use BullMQ repeat jobs or cron
- Add to worker startup in `apps/worker/src/index.ts`
- Log job execution
- Alert on failures

**Integration:** Will integrate with EPIC 07 (Billing) once balance checks are implemented.

---

## From EPIC 05 (Filters & Eligibility)

### No Deferred Items ✅

All MVP requirements for EPIC 05 were implemented. P3 future enhancements noted in review:
- Advanced filtering (nested AND/OR groups)
- Filter templates
- Filter suggestions (AI-powered)
- Filter analytics
- Bulk filter operations

**Status:** All are out of MVP scope, to be considered post-launch based on user feedback.

---

## From EPIC 07 (Billing & Payments)

### 1. Balance Reconciliation Job (P3)
**Target Epic:** EPIC 12 - Observability & Ops  
**Status:** 🔴 Not Started  
**Effort:** 0.5 hours

**Context:** Provider cached balance should be periodically reconciled against the immutable ledger to detect any discrepancies.

**Recommendation:**
- Implement nightly cron job (3 AM)
- Compare `providers.balance` vs `SUM(provider_ledger.amount)` for all providers
- Use tolerance of 0.01 for floating point comparison
- Log discrepancies with severity: warning
- Alert if discrepancies > 1.00 USD
- Auto-correct discrepancies if within tolerance

**Implementation:**
- Create job in `apps/worker/src/jobs/balance-reconciliation.ts`
- Use `calculateBalance()` from ledger service
- Schedule via BullMQ repeat jobs
- Add monitoring metrics

**Expected Impact:**
- Early detection of balance calculation bugs
- Increased confidence in billing accuracy
- Compliance for financial audits

---

### 2. Payment Retry Logic (P3)
**Target Epic:** Future (post-MVP)  
**Status:** 🔴 Not Started  
**Effort:** 1.0 hour

**Context:** Failed payments (status='failed') are not automatically retried. Providers must manually retry deposits.

**Recommendation:**
- Automatic retry for transient failures (network, gateway timeout)
- Max 3 retries with exponential backoff
- Do not retry for permanent failures (invalid card, insufficient funds)
- Notify provider after final retry failure

**Implementation:**
- Add retry logic in payment service
- Use BullMQ job retries
- Distinguish between transient and permanent failures
- Add retry count to payments table

**Note:** Low priority as providers can manually retry.

---

### 3. Multi-Currency Support (P3)
**Target Epic:** Future (post-MVP)  
**Status:** 🔴 Not Started  
**Effort:** 2.0 hours

**Context:** System currently only supports USD. Schema has `currency` field prepared for future expansion.

**Recommendation:**
- Support EUR, GBP, CAD at minimum
- Use currency conversion service (e.g., exchangeratesapi.io)
- Store amounts in original currency + USD equivalent
- Update all displays to show currency symbol
- Add currency selection in deposit flow

**Implementation:**
- Add currency conversion service
- Update all amount displays to include currency
- Add currency selector to deposit UI
- Update validation to support multiple currencies
- Update email templates with currency context

**Note:** Schema already supports this. Deferred until international expansion.

---

### 4. Auto-Topup Execution (P3)
**Target Epic:** Future (post-MVP)  
**Status:** 🔴 Not Started  
**Effort:** 2.0 hours

**Context:** Providers table includes auto-topup fields (`auto_topup_enabled`, `auto_topup_threshold`, `auto_topup_amount`). Execution logic not implemented.

**Recommendation:**
- Implement in balance-alerts service
- Check auto-topup settings during low-balance check
- Automatically initiate deposit when threshold crossed
- Requires stored payment method (Stripe Customer ID)
- Send confirmation email after auto-topup

**Implementation:**
- Extend `checkLowBalanceAlert()` in balance-alerts service
- Use Stripe Payment Intents API with stored payment method
- Add `TOPUP_INITIATED` and `TOPUP_COMPLETED` audit actions
- Update email templates
- Add UI for providers to configure auto-topup

**Note:** Requires stored payment methods, which is out of MVP scope.

---

### 5. PayPal Webhook Verification Enhancement (P3)
**Target Epic:** Future (post-MVP)  
**Status:** 🔴 Not Started  
**Effort:** 1.0 hour

**Context:** PayPal webhook verification is simplified for MVP. Full signature verification not implemented.

**Recommendation:**
- Implement full PayPal webhook signature verification
- Use PayPal SDK's verification helpers
- Verify webhook origin (PayPal IPs)
- Add webhook signing certificate validation

**Implementation:**
- Update `verifyPayPalWebhook()` in paypal gateway
- Use PayPal SDK verification methods
- Add certificate caching
- Add webhook ID validation

**Note:** Current simplified verification is acceptable for MVP. Enhanced security for production.

---

## Priority Summary

### P1 (Critical for MVP)
- None currently

### P2 (Important for Production)
- 🔴 Rate limiting for admin lead routes (EPIC 01) - 2 hours
- 🔴 Email queue monitoring (EPIC 12) - 4 hours

### P3 (Nice to Have)
- 🔴 Caching for stats endpoint (EPIC 11) - 2 hours
- 🔴 Advanced lead filtering (EPIC 11) - 4 hours
- 🔴 CSV export of leads (EPIC 11) - 3 hours
- 🔴 Redis caching for competition levels (EPIC 11) - 4 hours
- 🔴 Template management UI (EPIC 11) - 8 hours
- 🔴 Scheduled subscription reactivation job (EPIC 12) - 2 hours
- 🔴 Balance reconciliation job (EPIC 12) - 0.5 hours
- 🔴 Payment retry logic (Future) - 1 hour
- 🔴 Multi-currency support (Future) - 2 hours
- 🔴 Auto-topup execution (Future) - 2 hours
- 🔴 PayPal webhook enhancement (Future) - 1 hour

### Out of MVP Scope
- Batch scheduling (Future)
- Webhooks for external systems (Future)
- EPIC 05 advanced filtering features (Future - based on user feedback)
- Multi-currency support (Future - international expansion)
- Auto-topup (Future - requires stored payment methods)
- Payment retry logic (Future - low priority, manual retry available)

---

## Total Deferred Effort

**P2 Items:** 6 hours  
**P3 Items:** 29.5 hours  
**Total:** 35.5 hours (~4.5 days)

---

## Action Plan

### Immediate (Before EPIC 05)
1. ✅ Implement EPIC 04 rate limiting - COMPLETE
2. 🔴 Implement EPIC 03 rate limiting - Next

### During EPIC 11 (Reporting & Analytics)
- Implement all caching (stats, competition levels)
- Implement advanced filtering
- Implement CSV export
- Optionally: Template management UI

### During EPIC 12 (Observability & Ops)
- Implement email queue monitoring
- Implement scheduled subscription job
- Set up alerting for all deferred items

---

## Notes

- All deferred items are documented in respective epic specifications
- This master tracker provides cross-epic visibility
- Priorities may shift based on production needs
- Update this document as items are completed

---

## Review Process

### When Planning an Epic

**STEP 1:** Check this tracker before creating implementation plan
```bash
cat .cursor/docs/Delivery/DEFERRED_ITEMS_SUMMARY.md
```

**STEP 2:** Check the epic specification for deferred items section
```bash
# Example for EPIC 11
grep -A 20 "⚠️ Deferred Items" .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
```

**STEP 3:** Decide which deferred items to implement
- **P1 items:** MUST implement (blocking)
- **P2 items:** SHOULD implement before production
- **P3 items:** MAY implement based on priority

**STEP 4:** Include deferred items in implementation plan
- Add as phases in `EPIC_XX_IMPLEMENTATION_PLAN.md`
- Document decision if deferring P2 items further
- Update effort estimates

### When Completing an Epic

**STEP 1:** Identify any new deferred items during review
- Performance optimizations
- Security enhancements
- Feature improvements
- Technical debt

**STEP 2:** Document each deferred item
- Add to this tracker (DEFERRED_ITEMS_SUMMARY.md)
- Add to target epic specification (⚠️ section)
- Include: context, priority, effort, recommendation

**STEP 3:** Update status of completed deferred items
- Mark items as ✅ Complete in this tracker
- Update epic specification status
- Create completion report if significant

### Review Frequency

- **Before each epic:** Check for deferred items
- **After each epic:** Document new deferred items
- **Monthly:** Review P2 items for prioritization
- **Before production:** Ensure all P1/P2 items complete

---

**Maintained By:** Development Team  
**Last Reviewed:** Jan 4, 2026 (EPIC 06 - No deferred items for this epic)  
**Last Updated:** Jan 4, 2026 (Added EPIC 05 & EPIC 07 items)  
**Next Review:** Before EPIC 08

