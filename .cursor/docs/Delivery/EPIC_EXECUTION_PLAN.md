# Epic Execution Plan

## Overview

This document outlines the strategic order for implementing all MVP epics based on dependencies, business value, and technical efficiency.

---

## Dependency Graph

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    EPIC 01 ✅                            │
                    │            Platform Foundation                          │
                    └─────────────────────┬───────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
        ▼                                 ▼                                 ▼
┌───────────────┐               ┌───────────────┐               ┌───────────────┐
│   EPIC 10     │               │   EPIC 04     │               │   EPIC 07     │
│    Email      │               │ Competition   │               │   Billing     │
│Infrastructure │               │   Levels      │               │  & Payments   │
└───────┬───────┘               └───────┬───────┘               └───────┬───────┘
        │                               │                               │
        ▼                               ▼                               │
┌───────────────┐               ┌───────────────┐                       │
│   EPIC 02     │               │   EPIC 05     │                       │
│ Lead Intake & │               │   Filters &   │                       │
│ Confirmation  │               │  Eligibility  │                       │
└───────┬───────┘               └───────┬───────┘                       │
        │                               │                               │
        │                               └───────────────┬───────────────┘
        │                                               │
        ▼                                               ▼
┌───────────────┐                             ┌───────────────┐
│   EPIC 03     │                             │   EPIC 06     │
│ Admin Lead    │                             │  Distribution │
│   Review      │                             │    Engine     │
└───────────────┘                             └───────┬───────┘
                                                      │
                        ┌─────────────────────────────┼─────────────────────────────┐
                        │                             │                             │
                        ▼                             ▼                             ▼
              ┌───────────────┐             ┌───────────────┐             ┌───────────────┐
              │   EPIC 08     │             │   EPIC 09     │             │   EPIC 11     │
              │   Provider    │             │  Bad Lead &   │             │  Reporting &  │
              │  Dashboard    │             │   Refunds     │             │  Analytics    │
              └───────────────┘             └───────────────┘             └───────────────┘
                                                                                  │
                                                                                  ▼
                                                                        ┌───────────────┐
                                                                        │   EPIC 12     │
                                                                        │ Observability │
                                                                        └───────────────┘
```

---

## Execution Phases

### Phase 1: Infrastructure & Foundation ✅
**Status: COMPLETE**

| Epic | Name | Status | Notes |
|------|------|--------|-------|
| 01 | Platform Foundation | ✅ Done | Auth, RBAC, MFA, Audit Logging |

---

### Phase 2: Core Infrastructure
**Goal:** Build the infrastructure needed by multiple epics

| Order | Epic | Name | Dependencies | Effort | Priority |
|-------|------|------|--------------|--------|----------|
| 1 | **10** | Email Infrastructure | EPIC 01 | 2-3 days | HIGH |
| 2 | **04** | Competition Levels | EPIC 01 | 2-3 days | HIGH |
| 3 | **07** | Billing & Payments | EPIC 01 | 3-4 days | HIGH |

**Rationale:**
- **EPIC 10** provides email infrastructure used by auth (already stubbed), lead confirmation, and notifications
- **EPIC 04** defines competition levels and provider subscriptions - core data model
- **EPIC 07** manages provider balances - required for distribution gating

These can be developed **in parallel** as they have no dependencies on each other.

---

### Phase 3: Lead Pipeline
**Goal:** Enable lead capture and approval workflow

| Order | Epic | Name | Dependencies | Effort | Priority |
|-------|------|------|--------------|--------|----------|
| 4 | **02** | Lead Intake & Confirmation | EPIC 01, 10 | 2-3 days | HIGH |
| 5 | **05** | Filters & Eligibility | EPIC 01, 04 | 2-3 days | HIGH |
| 6 | **03** | Admin Lead Review | EPIC 01, 02 | 1-2 days | MEDIUM |

**Rationale:**
- **EPIC 02** enables lead submission with email confirmation
- **EPIC 05** defines provider filters (what leads they want)
- **EPIC 03** adds admin approval before distribution

---

### Phase 4: Distribution Engine
**Goal:** The core business logic - matching leads to providers

| Order | Epic | Name | Dependencies | Effort | Priority |
|-------|------|------|--------------|--------|----------|
| 7 | **06** | Distribution Engine | EPIC 04, 05, 07 | 3-4 days | CRITICAL |

**Rationale:**
- This is the heart of the platform - fair, deterministic lead distribution
- Requires competition levels (04), filters (05), and billing (07) to be complete

---

### Phase 5: User Experience
**Goal:** Provider-facing features and dispute handling

| Order | Epic | Name | Dependencies | Effort | Priority |
|-------|------|------|--------------|--------|----------|
| 8 | **08** | Provider Dashboard | EPIC 06, 07 | 2-3 days | MEDIUM |
| 9 | **09** | Bad Lead & Refunds | EPIC 06, 07 | 2-3 days | MEDIUM |

---

### Phase 6: Operations & Analytics
**Goal:** Reporting and production readiness

| Order | Epic | Name | Dependencies | Effort | Priority |
|-------|------|------|--------------|--------|----------|
| 10 | **11** | Reporting & Analytics | EPIC 06, 07 | 2-3 days | LOW |
| 11 | **12** | Observability & Ops | All epics | 2-3 days | LOW |

---

## Recommended Execution Order

```
Week 1-2: Phase 2 (Parallel)
├── EPIC 10: Email Infrastructure
├── EPIC 04: Competition Levels & Subscriptions
└── EPIC 07: Billing & Payments

Week 2-3: Phase 3
├── EPIC 02: Lead Intake & Confirmation
├── EPIC 05: Filters & Eligibility
└── EPIC 03: Admin Lead Review

Week 3-4: Phase 4
└── EPIC 06: Distribution Engine (CRITICAL PATH)

Week 4-5: Phase 5
├── EPIC 08: Provider Dashboard
└── EPIC 09: Bad Lead & Refunds

Week 5-6: Phase 6
├── EPIC 11: Reporting & Analytics
└── EPIC 12: Observability & Ops
```

---

## Critical Path Analysis

The **critical path** to a working MVP (lead → distribution → provider):

```
EPIC 01 ✅ → EPIC 10 → EPIC 02 → EPIC 04 → EPIC 05 → EPIC 07 → EPIC 06
```

**Minimum viable flow:**
1. Provider registers (EPIC 01 ✅)
2. Provider subscribes to competition level (EPIC 04)
3. Provider adds balance (EPIC 07)
4. Provider sets filters (EPIC 05)
5. End user submits lead (EPIC 02)
6. Lead confirmed via email (EPIC 10)
7. Lead distributed to eligible providers (EPIC 06)

---

## Next Epic Recommendation

Based on the analysis, the recommended next epic is:

### Option A: EPIC 10 (Email Infrastructure)
**Pros:**
- Lightweight infrastructure (~2 days)
- Unblocks EPIC 02 (lead confirmation)
- Completes the auth flow (email verification)
- BullMQ worker already scaffolded

### Option B: EPIC 04 (Competition Levels)
**Pros:**
- Core business model
- Defines provider subscription structure
- No external dependencies
- Can be done in parallel with EPIC 10

### Option C: EPIC 07 (Billing)
**Pros:**
- Critical for distribution gating
- Stripe/PayPal integration
- Can be done in parallel with others

---

## My Recommendation

**Start with EPIC 10 (Email Infrastructure)** because:
1. It's the smallest of the three (~2 days)
2. It completes EPIC 01 auth flows (email verification, password reset)
3. It unblocks EPIC 02 (lead confirmation is email-dependent)
4. BullMQ worker is already scaffolded
5. MailHog is already running in Docker

After EPIC 10, proceed with **EPIC 04** and **EPIC 07** (can be parallelized).

---

## Epic Status Tracker

| Phase | Epic | Name | Status | Started | Completed |
|-------|------|------|--------|---------|-----------|
| 1 | 01 | Platform Foundation | ✅ Done | Jan 3, 2026 | Jan 3, 2026 |
| 2 | 10 | Email Infrastructure | ✅ Done | Jan 3, 2026 | Jan 4, 2026 |
| 3 | 02 | Lead Intake & Confirmation | ⬜ **NEXT** | | |
| 2 | 04 | Competition Levels | ⬜ Pending | | |
| 2 | 07 | Billing & Payments | ⬜ Pending | | |
| 3 | 02 | Lead Intake | ⬜ Pending | | |
| 3 | 05 | Filters & Eligibility | ⬜ Pending | | |
| 3 | 03 | Admin Lead Review | ⬜ Pending | | |
| 4 | 06 | Distribution Engine | ⬜ Pending | | |
| 5 | 08 | Provider Dashboard | ⬜ Pending | | |
| 5 | 09 | Bad Lead & Refunds | ⬜ Pending | | |
| 6 | 11 | Reporting & Analytics | ⬜ Pending | | |
| 6 | 12 | Observability & Ops | ⬜ Pending | | |

---

**Total Estimated Effort:** 25-35 days (5-7 weeks)

