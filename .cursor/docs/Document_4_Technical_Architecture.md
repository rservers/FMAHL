# Architecture Document
## Find Me A Hot Lead – Technical Architecture & Design (Document 4)

**Version:** 1.1  
**Date:** December 27, 2025  
**Status:** MVP Architecture (Patched)  
**Author:** Engineering Team  

---

## Table of Contents
1. System Overview  
2. Architecture Principles  
3. Tech Stack  
4. System Architecture  
5. Database Schema  
6. API Design  
7. Component Hierarchy  
8. Data Flow  
9. Security Architecture  
10. Deployment Architecture  
11. Monitoring & Observability  
12. Backup & Disaster Recovery  
13. Scalability Considerations  

---

## 1. System Overview

Find Me A Hot Lead is a multi-tenant B2B SaaS platform that captures user-submitted service requests and distributes them fairly to subscribed Service Providers using a competition-based, pay-per-lead model.

The system is designed to:
- Ensure fairness and transparency in lead distribution
- Maintain strong financial correctness and auditability
- Support future expansion across niches and integrations
- Operate as an API-first platform

---

## 2. Architecture Principles

- API-first, integration-ready design
- Strong consistency for financial operations
- Event-driven background processing
- Deterministic fairness in lead distribution
- Append-only financial ledger
- Immutable audit logs
- Explicit state machines over implicit logic

---

## 3. Tech Stack

### Backend
- Node.js / TypeScript
- RESTful APIs
- Background workers (BullMQ or equivalent)

### Database
- PostgreSQL (primary datastore)
- Redis (queues, idempotency, rate limiting)

### Payments
- Stripe
- PayPal

### Email
- Transactional email provider (e.g., local mail server, SES)
- Email sandbox for non-production (MailHog)

### Monitoring
- Prometheus
- Grafana
- Centralized logging (e.g., Loki)

---

## 4. System Architecture

### Core Services
- Lead Intake Service
- Distribution Engine
- Financial Ledger Service
- Audit & Governance Service
- Notification Service
- Background Job Workers

### Public vs Private APIs
- Public APIs are strictly limited to lead submission and confirmation
- All administrative and provider APIs require authentication
- Internal APIs are not publicly exposed

---

## 5. Database Schema

### 5.1 Leads

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  niche_id UUID NOT NULL,
  status ENUM (
    'pending_confirmation',
    'pending_approval',
    'approved',
    'distributed',
    'rejected',
    'bad_lead'
  ) NOT NULL,
  payload JSONB NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  referrer_url TEXT,
  utm_params JSONB,
  partner_id UUID,
  confirmation_token_hash VARCHAR(255),
  confirmation_expires_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

**Invariant:**  
A lead cannot transition to `pending_approval` unless `confirmed_at` is set.

---

### 5.2 Service Providers

```sql
CREATE TABLE service_providers (
  id UUID PRIMARY KEY,
  status ENUM ('active', 'inactive', 'auto_deactivated') NOT NULL,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);
```

---

### 5.3 Competition Levels

```sql
CREATE TABLE competition_levels (
  id UUID PRIMARY KEY,
  niche_id UUID NOT NULL,
  name TEXT NOT NULL,
  price_per_lead DECIMAL(10,2) NOT NULL,
  max_providers INT NOT NULL,
  priority_order INT NOT NULL,
  active BOOLEAN DEFAULT true
);
```

---

### 5.4 Provider Subscriptions

```sql
CREATE TABLE provider_subscriptions (
  id UUID PRIMARY KEY,
  provider_id UUID NOT NULL,
  competition_level_id UUID NOT NULL,
  filters JSONB NOT NULL,
  last_received_at TIMESTAMP,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
```

---

### 5.5 Lead Assignments

```sql
CREATE TABLE lead_assignments (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  competition_level_id UUID NOT NULL,
  charged_amount DECIMAL(10,2) NOT NULL,
  is_refunded BOOLEAN DEFAULT false,
  refunded_at TIMESTAMP,
  refund_reason TEXT,
  assigned_at TIMESTAMP DEFAULT now(),
  UNIQUE (lead_id, provider_id)
);
```

Refunds are **assignment-level only**. Lead state is unchanged by refunds.

---

### 5.6 Financial Ledger

```sql
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY,
  provider_id UUID NOT NULL,
  type ENUM ('deposit', 'charge', 'refund', 'credit', 'debit') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMP DEFAULT now()
);
```

Ledger is append-only.

---

### 5.7 Audit Logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor_id UUID,
  actor_role ENUM ('admin', 'provider', 'buyer', 'system') NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  admin_only_memo TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

Audit logs are immutable.  
`admin_only_memo` is never exposed outside Admin views.

---

## 6. API Design

### Public APIs
- Submit lead
- Confirm lead submission (signed token)

### Authenticated APIs
- Admin: approve/reject leads, manage providers, refunds
- Service Provider: manage subscriptions, view leads, manage balance

---

## 7. Component Hierarchy

- API Controllers
- Domain Services
- Distribution Engine
- Background Workers
- Persistence Layer

---

## 8. Data Flow

### Lead Submission & Confirmation
1. Lead submitted → `pending_confirmation`
2. Confirmation email sent with signed token
3. Token validated → `confirmed_at` set
4. Lead transitions to `pending_approval`
5. Admin approval → `approved`

Rejected leads stop permanently and are never distributed.

---

### Distribution Engine (Fairness-Critical)

For each approved lead and competition level:
1. Determine eligible providers:
   - Active subscription
   - Filters match
   - Sufficient balance
   - Provider has not already received this lead
2. Sort eligible providers by:
   - `last_received_at ASC NULLS FIRST`
   - `created_at ASC`
3. Assign providers up to `max_providers`
4. Update `last_received_at` on assignment

Competition Levels are traversed in rotating order per lead.
Providers are deduplicated globally.

---

## 9. Security Architecture

- Role-based access control
- Signed confirmation tokens
- Rate limiting on public endpoints
- Payment webhook verification
- No internal APIs publicly exposed

---

## 10. Deployment Architecture

- Containerized services
- Environment separation (Dev / Staging / Prod)
- Background workers scaled independently

---

## 11. Monitoring & Observability

- Prometheus metrics
- Grafana dashboards
- Centralized structured logs
- Alerting on queue backlogs, failures, payment errors

---

## 12. Backup & Disaster Recovery

- Automated PostgreSQL backups
- Encrypted storage
- Restore testing cadence

---

## 13. Scalability Considerations

- Horizontal scaling of API and workers
- Queue-based load leveling
- Schema designed for multi-niche growth

---

## Notes & Invariants

- Leads cannot be rejected once distributed
- Distributed leads may only be invalidated via Global Bad Lead
- Email open tracking is informational only and does not determine refunds
- Filter changes affect only undistributed leads
- Balance restoration auto-reactivates eligible subscriptions

---

**End of Document**

