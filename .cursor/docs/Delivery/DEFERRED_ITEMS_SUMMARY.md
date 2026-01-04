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

### Out of MVP Scope
- Batch scheduling (Future)
- Webhooks for external systems (Future)

---

## Total Deferred Effort

**P2 Items:** 6 hours  
**P3 Items:** 23 hours  
**Total:** 29 hours (~3.5 days)

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

**Maintained By:** Development Team  
**Review Frequency:** After each epic completion

