# Architecture Document
## Find Me A Hot Lead - Technical Architecture & Design

**Version:** 1.0  
**Date:** December 27, 2025  
**Status:** MVP Architecture  
**Author:** Engineering Team

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Tech Stack](#tech-stack)
4. [System Architecture](#system-architecture)
5. [Database Schema](#database-schema)
6. [API Design](#api-design)
7. [Component Hierarchy](#component-hierarchy)
8. [Data Flow](#data-flow)
9. [Security Architecture](#security-architecture)
10. [Deployment Architecture](#deployment-architecture)
11. [Monitoring & Observability](#monitoring--observability)
12. [Backup & Disaster Recovery](#backup--disaster-recovery)
13. [Scalability Considerations](#scalability-considerations)

---

## System Overview

**Find Me A Hot Lead** is a multi-tenant B2B SaaS platform built with a modern monolith architecture, designed for rapid MVP delivery while maintaining extensibility for future microservices migration.

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                         End Users (Web)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 14+ (App Router)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Public Pages│  │Provider Dash │  │ Admin Dash   │         │
│  │  (Lead Forms)│  │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js API Routes)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Auth API    │  │  Leads API   │  │ Providers API│         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Payments API │  │  Admin API   │  │ Webhooks API │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Lead Distribution Service (Round-Robin Algorithm)       │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ User Service │  │ Payment Svc  │  │ Email Service│         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Niche Service│  │ Refund Svc   │  │ Audit Service│         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data & Infrastructure Layer                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ PostgreSQL   │  │    Redis     │  │   Stripe     │         │
│  │ (Primary DB) │  │  (BullMQ)    │  │  (Payments)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  TrueNAS S3  │  │  Amazon SES  │  │   Grafana    │         │
│  │  (Storage)   │  │   (Email)    │  │ (Monitoring) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Principles

### 1. API-First Design
- All business logic exposed via REST APIs
- First-party UI consumes same APIs as future partners
- Enables future partner integrations, mobile apps, and CRM plugins

### 2. Financial Accuracy
- All financial operations wrapped in database transactions
- Optimistic locking for balance updates
- DECIMAL/NUMERIC types for money (never FLOAT)
- Complete audit trail in ledger
- Idempotency for payment operations

### 3. Multi-Tenancy
- Row-Level Security (RLS) for data isolation
- Providers only see their own data
- Admins see all data
- Future: Organization-level tenancy for enterprise

### 4. Extensibility
- Dynamic form schemas (JSONB + metadata layer)
- Niche-agnostic distribution engine
- Plugin architecture for future CRM integrations
- Schema versioning for backward compatibility

### 5. Performance
- Database indexes on all foreign keys and frequently queried columns
- Connection pooling (max 10 connections)
- Redis caching for session data (future)
- Pagination for all list endpoints (default 20 items)
- Lazy loading for large datasets

### 6. Security
- JWT authentication with 7-day expiry
- bcrypt password hashing (cost factor 10)
- Rate limiting on all endpoints
- HTTPS only in production
- Parameterized queries (SQL injection prevention)
- CSP headers (XSS prevention)
- CSRF protection for state-changing operations

### 7. Observability
- Structured logging (JSON format)
- Distributed tracing (future)
- Metrics collection (Prometheus)
- Alerting (Grafana)
- Audit logs for all critical actions

### 8. Self-Hosted First
- Prefer self-hosted solutions (PostgreSQL, Redis, Grafana)
- Use managed services only when they save significant time/cost
- Full control over data and infrastructure

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript 5+
- **UI Library**: React 18+
- **Styling**: Tailwind CSS 3+
- **Component Library**: shadcn/ui
- **Forms**: React Hook Form + Zod
- **State Management**: React Context + Server State (Next.js)
- **HTTP Client**: Fetch API (native)

**Rationale:**
- Next.js App Router: Server Components, Server Actions, built-in API routes
- TypeScript: Type safety, better DX, fewer runtime errors
- Tailwind: Rapid UI development, consistent design system
- shadcn/ui: Accessible, customizable components
- Zod: Runtime validation, type inference

---

### Backend
- **Framework**: Next.js API Routes (primary), Node.js (background jobs)
- **Language**: TypeScript 5+
- **Runtime**: Node.js 20 LTS
- **API Style**: RESTful
- **Authentication**: JWT (custom implementation)
- **Validation**: Zod

**Rationale:**
- Next.js API Routes: Collocated with frontend, fast development
- TypeScript: Shared types between frontend/backend
- JWT: Stateless, scalable, no session storage needed
- Zod: Consistent validation across frontend/backend

---

### Database
- **Primary Database**: PostgreSQL 16
- **Extensions**: PostGIS (for location-based niches)
- **ORM**: None (raw SQL with postgres.js)
- **Migrations**: Custom migration system
- **Connection Pooling**: postgres.js built-in

**Rationale:**
- PostgreSQL: ACID compliance, JSONB support, mature, reliable
- PostGIS: Geographic queries for location-based niches
- Raw SQL: Full control, better performance, no ORM overhead
- postgres.js: Lightweight, fast, TypeScript support

---

### Background Jobs
- **Queue**: BullMQ
- **Storage**: Redis 7+
- **Job Types**:
  - Email notifications (new lead, bad lead decision, low balance)
  - Lead distribution (async after admin approval)
  - Provider filter upgrades (after schema changes)
  - Daily reports (revenue, lead volume)
  - Backup jobs (database, files)

**Rationale:**
- BullMQ: Reliable, Redis-backed, retries, scheduling
- Redis: Fast, persistent, battle-tested

---

### Payments
- **Provider**: Stripe
- **Integration**: Stripe Checkout (deposits), Stripe API (refunds)
- **Webhooks**: Stripe webhooks for payment confirmation

**Rationale:**
- Stripe: PCI compliant, easy integration, reliable
- Checkout: Hosted payment page (no PCI compliance burden)

---

### Email
- **Development**: MailHog (local SMTP server)
- **Production**: Amazon SES
- **Templates**: HTML templates with variable substitution
- **Tracking**: Open tracking (future)

**Rationale:**
- MailHog: Easy local testing, no external dependencies
- Amazon SES: Cost-effective, reliable, high deliverability
- HTML templates: Branded emails, better engagement

---

### File Storage
- **Primary**: TrueNAS S3 API (self-hosted)
- **Backup**: Wasabi (S3-compatible)
- **Use Cases**: Provider logos, lead attachments (future)

**Rationale:**
- TrueNAS: Self-hosted, full control, no egress fees
- Wasabi: Cheap backup, S3-compatible, no egress fees
- S3 API: Standard interface, easy migration

---

### Monitoring & Observability
- **Metrics**: Prometheus (self-hosted)
- **Visualization**: Grafana (self-hosted)
- **Logs**: Loki (self-hosted)
- **Alerting**: Grafana Alerting
- **Error Tracking**: Sentry (optional, if needed)

**Rationale:**
- Prometheus: Industry standard, powerful querying
- Grafana: Beautiful dashboards, alerting
- Loki: Log aggregation, integrates with Grafana
- Self-hosted: Full control, no data sharing

---

### Testing
- **Unit/Integration**: Vitest
- **API Tests**: SuperTest + Vitest
- **E2E Tests**: Playwright
- **Coverage Target**: 80%+

**Rationale:**
- Vitest: Fast, modern, Vite-powered
- SuperTest: Simple API testing
- Playwright: Reliable E2E, cross-browser

---

### CI/CD
- **Platform**: GitHub Actions
- **Workflows**:
  - Lint & Type Check (on every push)
  - Unit Tests (on every push)
  - API Tests (on every push)
  - E2E Tests (on PR to main)
  - Build (on PR to main)
  - Deploy (on merge to main)

**Rationale:**
- GitHub Actions: Free for private repos, easy setup
- Parallel execution: Fast feedback

---

### Deployment
- **Containerization**: Docker
- **Orchestration**: Docker Swarm (MVP), Kubernetes (future)
- **Environments**: Local, Dev, Staging, Production
- **Reverse Proxy**: Nginx (SSL termination, load balancing)
- **SSL**: Let's Encrypt (automated renewal)

**Rationale:**
- Docker: Consistent environments, easy scaling
- Docker Swarm: Simpler than Kubernetes, sufficient for MVP
- Nginx: Battle-tested, high performance
- Let's Encrypt: Free, automated

---

## System Architecture

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Internet                                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Cloudflare (DNS)     │
                    │   + DDoS Protection    │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Nginx (Reverse Proxy)│
                    │   SSL Termination      │
                    │   Load Balancer        │
                    └────────────┬───────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
    ┌────────────────────────┐      ┌────────────────────────┐
    │   Next.js App (Node 1) │      │   Next.js App (Node 2) │
    │   - Frontend (SSR)     │      │   - Frontend (SSR)     │
    │   - API Routes         │      │   - API Routes         │
    │   - Business Logic     │      │   - Business Logic     │
    └────────────┬───────────┘      └────────────┬───────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
    ┌────────────────────────┐      ┌────────────────────────┐
    │   PostgreSQL (Primary) │      │   Redis (Primary)      │
    │   - Leads              │      │   - BullMQ Queues      │
    │   - Providers          │      │   - Session Cache      │
    │   - Transactions       │      │   - Rate Limiting      │
    └────────────┬───────────┘      └────────────────────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │ PostgreSQL (Replica)   │
    │ - Read-only            │
    │ - Reporting            │
    └────────────────────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │   Wasabi (Backup)      │
    │   - DB Backups         │
    │   - File Backups       │
    └────────────────────────┘

External Services:
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│   Stripe               │  │   Amazon SES           │  │   TrueNAS S3           │
│   - Payments           │  │   - Email Sending      │  │   - File Storage       │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘

Monitoring:
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│   Prometheus           │  │   Grafana              │  │   Loki                 │
│   - Metrics Collection │  │   - Dashboards         │  │   - Log Aggregation    │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘
```

---

## Database Schema

### Core Tables

#### 1. users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'provider', 'buyer')),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  email_verification_expires_at TIMESTAMPTZ,
  password_reset_token VARCHAR(255),
  password_reset_expires_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'deactivated', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
```

---

#### 2. providers
```sql
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  logo_url VARCHAR(500),
  balance DECIMAL(10, 2) DEFAULT 0.00 NOT NULL CHECK (balance >= 0),
  low_balance_threshold DECIMAL(10, 2) DEFAULT 100.00,
  low_balance_alert_email VARCHAR(255),
  low_balance_alert_sent BOOLEAN DEFAULT FALSE,
  notification_preferences JSONB DEFAULT '{"new_lead": true, "bad_lead_decision": true, "low_balance": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_providers_user_id ON providers(user_id);
CREATE INDEX idx_providers_balance ON providers(balance);
```

---

#### 3. niches
```sql
CREATE TABLE niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_location_based BOOLEAN DEFAULT FALSE,
  default_competition_level_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_niches_slug ON niches(slug);
CREATE INDEX idx_niches_is_active ON niches(is_active);
```

---

#### 4. niche_form_schemas
```sql
CREATE TABLE niche_form_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT FALSE,
  schema JSONB NOT NULL,
  -- schema structure:
  -- {
  --   "fields": [
  --     {
  --       "id": "budget",
  --       "label": "Monthly Budget",
  --       "type": "range",
  --       "required": true,
  --       "options": {"min": 0, "max": 10000, "step": 50}
  --     },
  --     {
  --       "id": "location",
  --       "label": "Server Location",
  --       "type": "multi-select",
  --       "required": true,
  --       "options": ["US", "EU", "Asia", "Australia"]
  --     }
  --   ]
  -- }
  change_summary TEXT,
  created_by UUID REFERENCES users(id),
  activated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  UNIQUE(niche_id, version)
);

CREATE INDEX idx_niche_form_schemas_niche_id ON niche_form_schemas(niche_id);
CREATE INDEX idx_niche_form_schemas_is_active ON niche_form_schemas(is_active);
```

---

#### 5. field_mappings
```sql
CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  from_version INTEGER NOT NULL,
  to_version INTEGER NOT NULL,
  field_id VARCHAR(100) NOT NULL,
  mapping_type VARCHAR(20) NOT NULL CHECK (mapping_type IN ('direct', 'renamed', 'split', 'merged', 'deprecated')),
  mapping_config JSONB,
  -- mapping_config examples:
  -- renamed: {"old_id": "cpu_cores", "new_id": "cpu"}
  -- split: {"old_id": "specs", "new_ids": ["cpu", "ram", "storage"]}
  -- merged: {"old_ids": ["first_name", "last_name"], "new_id": "full_name"}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_field_mappings_niche_id ON field_mappings(niche_id);
CREATE INDEX idx_field_mappings_versions ON field_mappings(from_version, to_version);
```

---

#### 6. competition_levels
```sql
CREATE TABLE competition_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  order_position INTEGER NOT NULL,
  max_distribution_count INTEGER NOT NULL CHECK (max_distribution_count > 0),
  price_per_lead DECIMAL(10, 2) NOT NULL CHECK (price_per_lead > 0),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(niche_id, order_position)
);

CREATE INDEX idx_competition_levels_niche_id ON competition_levels(niche_id);
CREATE INDEX idx_competition_levels_order ON competition_levels(niche_id, order_position);
CREATE INDEX idx_competition_levels_is_active ON competition_levels(is_active);
```

---

#### 7. leads
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id),
  schema_version INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'distributed', 'rejected', 'bad_lead')),

  -- Contact info
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(20),

  -- Form data (niche-specific)
  form_data JSONB NOT NULL,
  -- Example for VPS niche:
  -- {
  --   "budget": 100,
  --   "location": ["US", "EU"],
  --   "purpose": "Web Hosting",
  --   "cpu": "4 cores",
  --   "ram": "8GB",
  --   "storage": "SSD",
  --   "bandwidth": "5TB",
  --   "management": "Managed"
  -- }

  -- Location data (for location-based niches)
  location_point GEOGRAPHY(POINT, 4326),
  location_address TEXT,
  location_city VARCHAR(100),
  location_state VARCHAR(100),
  location_country VARCHAR(100),
  location_zip VARCHAR(20),

  -- Attribution
  referrer_url TEXT,
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  partner_id UUID,
  click_id VARCHAR(255),
  session_id VARCHAR(255),

  -- Admin actions
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_niche_id ON leads(niche_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_contact_email ON leads(contact_email);
CREATE INDEX idx_leads_utm_source ON leads(utm_source);
CREATE INDEX idx_leads_partner_id ON leads(partner_id);
CREATE INDEX idx_leads_location_point ON leads USING GIST(location_point);
```

---

#### 8. provider_subscriptions
```sql
CREATE TABLE provider_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  competition_level_id UUID NOT NULL REFERENCES competition_levels(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  is_paused BOOLEAN DEFAULT FALSE,

  -- Filters (niche-specific)
  filters JSONB DEFAULT '{}'::jsonb,
  -- Example for VPS niche:
  -- {
  --   "budget": {"min": 50, "max": 500},
  --   "location": ["US", "EU"],
  --   "purpose": ["Web Hosting", "Gaming"],
  --   "cpu": ["4 cores", "8+ cores"],
  --   "ram": ["8GB", "16GB+"],
  --   "storage": ["SSD", "NVMe"],
  --   "bandwidth": ["5TB", "Unlimited"],
  --   "management": ["Managed", "Fully Managed"]
  -- }

  -- Round-robin tracking
  last_received_at TIMESTAMPTZ,
  leads_received_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, competition_level_id)
);

CREATE INDEX idx_provider_subscriptions_provider_id ON provider_subscriptions(provider_id);
CREATE INDEX idx_provider_subscriptions_competition_level_id ON provider_subscriptions(competition_level_id);
CREATE INDEX idx_provider_subscriptions_is_active ON provider_subscriptions(is_active);
CREATE INDEX idx_provider_subscriptions_last_received_at ON provider_subscriptions(last_received_at NULLS FIRST);
```

---

#### 9. lead_assignments
```sql
CREATE TABLE lead_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES provider_subscriptions(id) ON DELETE CASCADE,
  competition_level_id UUID NOT NULL REFERENCES competition_levels(id),
  price_charged DECIMAL(10, 2) NOT NULL,
  is_refunded BOOLEAN DEFAULT FALSE,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, provider_id)
);

CREATE INDEX idx_lead_assignments_lead_id ON lead_assignments(lead_id);
CREATE INDEX idx_lead_assignments_provider_id ON lead_assignments(provider_id);
CREATE INDEX idx_lead_assignments_subscription_id ON lead_assignments(subscription_id);
CREATE INDEX idx_lead_assignments_created_at ON lead_assignments(created_at DESC);
```

---

#### 10. provider_ledger
```sql
CREATE TABLE provider_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES provider_subscriptions(id),
  lead_id UUID REFERENCES leads(id),
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'lead_purchase', 'refund', 'manual_credit', 'manual_debit')),
  amount DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  memo TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provider_ledger_provider_id ON provider_ledger(provider_id);
CREATE INDEX idx_provider_ledger_created_at ON provider_ledger(created_at DESC);
CREATE INDEX idx_provider_ledger_transaction_type ON provider_ledger(transaction_type);
```

---

#### 11. bad_lead_requests
```sql
CREATE TABLE bad_lead_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES lead_assignments(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('fake_contact', 'duplicate', 'spam', 'wrong_niche', 'other')),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_resolved')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  admin_memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bad_lead_requests_lead_id ON bad_lead_requests(lead_id);
CREATE INDEX idx_bad_lead_requests_provider_id ON bad_lead_requests(provider_id);
CREATE INDEX idx_bad_lead_requests_status ON bad_lead_requests(status);
CREATE INDEX idx_bad_lead_requests_created_at ON bad_lead_requests(created_at DESC);
```

---

#### 12. payments
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method VARCHAR(50),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_provider_id ON payments(provider_id);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
```

---

#### 13. audit_log
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  description TEXT NOT NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_action_type ON audit_log(action_type);
CREATE INDEX idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_log_entity_id ON audit_log(entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
```

---

### Database Functions

#### Lead Distribution Function
```sql
CREATE OR REPLACE FUNCTION distribute_lead(
  p_lead_id UUID,
  p_competition_level_id UUID
) RETURNS TABLE(provider_id UUID, price_charged DECIMAL) AS $$
DECLARE
  v_competition_level RECORD;
  v_provider RECORD;
  v_assigned_count INTEGER := 0;
BEGIN
  -- Get competition level details
  SELECT * INTO v_competition_level
  FROM competition_levels
  WHERE id = p_competition_level_id;

  -- Find eligible providers (round-robin order)
  FOR v_provider IN
    SELECT 
      ps.id AS subscription_id,
      ps.provider_id,
      p.balance,
      ps.last_received_at
    FROM provider_subscriptions ps
    JOIN providers p ON p.id = ps.provider_id
    WHERE ps.competition_level_id = p_competition_level_id
      AND ps.is_active = TRUE
      AND ps.is_paused = FALSE
      AND p.balance >= v_competition_level.price_per_lead
      AND NOT EXISTS (
        SELECT 1 FROM lead_assignments la
        WHERE la.lead_id = p_lead_id
          AND la.provider_id = ps.provider_id
      )
      -- TODO: Add filter matching logic here
    ORDER BY ps.last_received_at NULLS FIRST, ps.created_at
    LIMIT v_competition_level.max_distribution_count
  LOOP
    -- Deduct balance
    UPDATE providers
    SET balance = balance - v_competition_level.price_per_lead
    WHERE id = v_provider.provider_id;

    -- Create ledger entry
    INSERT INTO provider_ledger (
      provider_id, subscription_id, lead_id,
      transaction_type, amount, balance_after
    ) VALUES (
      v_provider.provider_id,
      v_provider.subscription_id,
      p_lead_id,
      'lead_purchase',
      -v_competition_level.price_per_lead,
      v_provider.balance - v_competition_level.price_per_lead
    );

    -- Create assignment
    INSERT INTO lead_assignments (
      lead_id, provider_id, subscription_id,
      competition_level_id, price_charged
    ) VALUES (
      p_lead_id,
      v_provider.provider_id,
      v_provider.subscription_id,
      p_competition_level_id,
      v_competition_level.price_per_lead
    );

    -- Update last_received_at
    UPDATE provider_subscriptions
    SET last_received_at = NOW(),
        leads_received_count = leads_received_count + 1
    WHERE id = v_provider.subscription_id;

    -- Return result
    provider_id := v_provider.provider_id;
    price_charged := v_competition_level.price_per_lead;
    RETURN NEXT;

    v_assigned_count := v_assigned_count + 1;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;
```

---

## API Design

### API Principles
- RESTful design
- Consistent response structure
- Proper HTTP status codes
- JWT authentication for protected endpoints
- Rate limiting (100 requests/minute per user)
- API versioning (/api/v1/...)
- Pagination for list endpoints (default 20 items, max 100)

### Response Structure
```typescript
// Success
{
  success: true,
  data: any
}

// Error
{
  success: false,
  error: string,
  details?: any
}

// Paginated
{
  success: true,
  data: any[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

---

### API Endpoints

#### Authentication
```
POST   /api/v1/auth/signup              # Provider signup
POST   /api/v1/auth/login               # Login (admin/provider)
POST   /api/v1/auth/logout              # Logout
POST   /api/v1/auth/verify-email        # Verify email
POST   /api/v1/auth/forgot-password     # Request password reset
POST   /api/v1/auth/reset-password      # Reset password
GET    /api/v1/auth/me                  # Get current user
```

#### Leads (Public)
```
POST   /api/v1/leads                    # Submit lead (public)
GET    /api/v1/leads/:id/thank-you      # Thank you page
```

#### Leads (Admin)
```
GET    /api/v1/admin/leads              # List all leads
GET    /api/v1/admin/leads/:id          # Get lead details
PATCH  /api/v1/admin/leads/:id          # Update lead
POST   /api/v1/admin/leads/:id/approve  # Approve lead
POST   /api/v1/admin/leads/:id/reject   # Reject lead
POST   /api/v1/admin/leads/:id/bad-lead # Mark as bad lead
GET    /api/v1/admin/leads/:id/distribution # View distribution
```

#### Providers (Provider)
```
GET    /api/v1/providers/me             # Get provider profile
PATCH  /api/v1/providers/me             # Update profile
GET    /api/v1/providers/me/leads       # List received leads
GET    /api/v1/providers/me/leads/:id   # Get lead details
GET    /api/v1/providers/me/balance     # Get balance
GET    /api/v1/providers/me/ledger      # Get transaction history
POST   /api/v1/providers/me/deposit     # Create Stripe Checkout session
```

#### Providers (Admin)
```
GET    /api/v1/admin/providers          # List all providers
GET    /api/v1/admin/providers/:id      # Get provider details
PATCH  /api/v1/admin/providers/:id      # Update provider
POST   /api/v1/admin/providers/:id/approve # Approve provider
POST   /api/v1/admin/providers/:id/deactivate # Deactivate provider
POST   /api/v1/admin/providers/:id/credit # Manual credit
POST   /api/v1/admin/providers/:id/debit # Manual debit
```

#### Subscriptions (Provider)
```
GET    /api/v1/subscriptions            # List my subscriptions
POST   /api/v1/subscriptions            # Subscribe to competition level
PATCH  /api/v1/subscriptions/:id        # Update filters
POST   /api/v1/subscriptions/:id/pause  # Pause subscription
POST   /api/v1/subscriptions/:id/resume # Resume subscription
DELETE /api/v1/subscriptions/:id        # Unsubscribe
```

#### Competition Levels (Admin)
```
GET    /api/v1/admin/competition-levels # List all levels
POST   /api/v1/admin/competition-levels # Create level
PATCH  /api/v1/admin/competition-levels/:id # Update level
DELETE /api/v1/admin/competition-levels/:id # Delete level
POST   /api/v1/admin/competition-levels/reorder # Reorder levels
```

#### Niches (Admin)
```
GET    /api/v1/admin/niches             # List all niches
POST   /api/v1/admin/niches             # Create niche
PATCH  /api/v1/admin/niches/:id         # Update niche
DELETE /api/v1/admin/niches/:id         # Delete niche
GET    /api/v1/admin/niches/:id/schema  # Get form schema
POST   /api/v1/admin/niches/:id/schema  # Create new schema version
PATCH  /api/v1/admin/niches/:id/schema/:version # Update schema
POST   /api/v1/admin/niches/:id/schema/:version/activate # Activate schema
```

#### Bad Lead Requests (Provider)
```
POST   /api/v1/bad-lead-requests        # Submit bad lead request
GET    /api/v1/bad-lead-requests        # List my requests
GET    /api/v1/bad-lead-requests/:id    # Get request details
```

#### Bad Lead Requests (Admin)
```
GET    /api/v1/admin/bad-lead-requests  # List all requests
POST   /api/v1/admin/bad-lead-requests/:id/approve # Approve request
POST   /api/v1/admin/bad-lead-requests/:id/reject # Reject request
```

#### Reports (Admin)
```
GET    /api/v1/admin/reports/revenue    # Revenue report
GET    /api/v1/admin/reports/refunds    # Refund report
GET    /api/v1/admin/reports/leads      # Lead volume report
GET    /api/v1/admin/reports/providers  # Provider performance report
GET    /api/v1/admin/reports/attribution # Attribution report
```

#### Webhooks
```
POST   /api/v1/webhooks/stripe          # Stripe webhook
```

---

## Component Hierarchy

### Frontend Structure
```
app/
├── (public)/                    # Public pages (no auth)
│   ├── page.tsx                # Homepage
│   ├── [niche]/                # Niche landing pages
│   │   └── page.tsx            # Lead submission form
│   └── thank-you/
│       └── page.tsx            # Thank you page
│
├── (auth)/                      # Auth pages
│   ├── login/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   ├── verify-email/
│   │   └── page.tsx
│   └── forgot-password/
│       └── page.tsx
│
├── dashboard/                   # Provider dashboard (protected)
│   ├── layout.tsx              # Dashboard layout
│   ├── page.tsx                # Overview
│   ├── leads/
│   │   ├── page.tsx            # Leads list
│   │   └── [id]/
│   │       └── page.tsx        # Lead details
│   ├── subscriptions/
│   │   └── page.tsx            # Manage subscriptions
│   ├── billing/
│   │   └── page.tsx            # Balance & payments
│   └── settings/
│       └── page.tsx            # Profile & preferences
│
├── admin/                       # Admin dashboard (protected)
│   ├── layout.tsx              # Admin layout
│   ├── page.tsx                # Admin overview
│   ├── leads/
│   │   ├── page.tsx            # Leads queue
│   │   └── [id]/
│   │       └── page.tsx        # Lead details
│   ├── providers/
│   │   ├── page.tsx            # Providers list
│   │   └── [id]/
│   │       └── page.tsx        # Provider details
│   ├── competition-levels/
│   │   └── page.tsx            # Manage levels
│   ├── niches/
│   │   ├── page.tsx            # Niches list
│   │   └── [id]/
│   │       ├── page.tsx        # Niche details
│   │       └── schema/
│   │           └── page.tsx    # Form schema editor
│   ├── bad-lead-requests/
│   │   └── page.tsx            # Review requests
│   ├── reports/
│   │   └── page.tsx            # Analytics & reports
│   └── settings/
│       └── page.tsx            # System settings
│
└── api/                         # API routes
    └── v1/
        ├── auth/
        ├── leads/
        ├── providers/
        ├── subscriptions/
        ├── admin/
        └── webhooks/
```

### Component Library
```
components/
├── ui/                          # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── form.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── table.tsx
│   └── ...
│
├── features/                    # Feature-specific components
│   ├── lead-form/
│   │   ├── LeadForm.tsx        # Dynamic form renderer
│   │   ├── FieldRenderer.tsx   # Renders field by type
│   │   └── FormPreview.tsx     # Preview form
│   ├── lead-card/
│   │   └── LeadCard.tsx        # Lead summary card
│   ├── provider-filters/
│   │   └── FilterEditor.tsx    # Filter configuration UI
│   ├── competition-level-card/
│   │   └── CompetitionLevelCard.tsx
│   ├── schema-editor/
│   │   ├── SchemaEditor.tsx    # Form schema editor
│   │   ├── FieldEditor.tsx     # Edit field properties
│   │   └── FieldList.tsx       # Drag-and-drop field list
│   └── charts/
│       ├── RevenueChart.tsx
│       ├── LeadVolumeChart.tsx
│       └── ProviderPerformanceChart.tsx
│
├── layouts/
│   ├── DashboardLayout.tsx     # Provider dashboard layout
│   ├── AdminLayout.tsx         # Admin dashboard layout
│   └── PublicLayout.tsx        # Public pages layout
│
└── shared/
    ├── Header.tsx
    ├── Footer.tsx
    ├── Sidebar.tsx
    ├── Pagination.tsx
    ├── LoadingSpinner.tsx
    └── ErrorBoundary.tsx
```

---

## Data Flow

### Lead Submission Flow
```
1. End User fills out lead form
   ↓
2. Frontend validates form (Zod schema)
   ↓
3. POST /api/v1/leads
   ↓
4. API validates request (Zod schema)
   ↓
5. Create lead record (status: pending_approval)
   ↓
6. Store attribution data (UTMs, referrer, etc.)
   ↓
7. Queue confirmation email (BullMQ)
   ↓
8. Return success response
   ↓
9. Redirect to thank you page
   ↓
10. Admin receives notification (new lead pending)
```

### Lead Distribution Flow
```
1. Admin approves lead
   ↓
2. POST /api/v1/admin/leads/:id/approve
   ↓
3. Update lead status (approved)
   ↓
4. Queue distribution job (BullMQ)
   ↓
5. Distribution job starts
   ↓
6. For each competition level (in order):
   a. Find eligible providers (balance, filters, not already assigned)
   b. Sort by last_received_at (round-robin)
   c. For each provider (up to max count):
      - Start transaction
      - Deduct balance
      - Create ledger entry
      - Create assignment
      - Update last_received_at
      - Commit transaction
      - Queue email notification
   d. If fewer than max assigned, cascade to next level
   ↓
7. Update lead status (distributed)
   ↓
8. Email notifications sent to providers
```

### Bad Lead Refund Flow (Provider-Initiated)
```
1. Provider requests refund
   ↓
2. POST /api/v1/bad-lead-requests
   ↓
3. Create bad_lead_request record (status: pending)
   ↓
4. Admin receives notification
   ↓
5. Admin reviews request
   ↓
6. Admin approves or rejects
   ↓
7. If approved:
   a. Start transaction
   b. Credit provider balance
   c. Create ledger entry (refund)
   d. Update assignment (is_refunded: true)
   e. Update request (status: approved)
   f. Commit transaction
   g. Queue email notification
   ↓
8. If rejected:
   a. Update request (status: rejected, admin_memo)
   b. Queue email notification
```

### Bad Lead Refund Flow (Admin-Initiated Global)
```
1. Admin marks lead as bad
   ↓
2. POST /api/v1/admin/leads/:id/bad-lead
   ↓
3. Update lead status (bad_lead)
   ↓
4. Find all assignments for this lead
   ↓
5. For each assignment:
   a. Start transaction
   b. Credit provider balance
   c. Create ledger entry (refund)
   d. Update assignment (is_refunded: true)
   e. Commit transaction
   f. Queue email notification
   ↓
6. Find all pending bad_lead_requests for this lead
   ↓
7. Update all requests (status: auto_resolved)
   ↓
8. Queue email notifications to all providers
```

---

## Security Architecture

### Authentication Flow
```
1. User submits login credentials
   ↓
2. POST /api/v1/auth/login
   ↓
3. Validate email/password
   ↓
4. Verify email is verified
   ↓
5. Verify account is active
   ↓
6. Generate JWT token (7-day expiry)
   ↓
7. Return token + user data
   ↓
8. Frontend stores token in memory (not localStorage)
   ↓
9. Frontend includes token in Authorization header for all requests
```

### Authorization Middleware
```typescript
// Verify JWT and extract user
export async function authenticate(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    throw new UnauthorizedError('Missing token')
  }

  const payload = verifyToken(token) // Throws if invalid/expired

  const user = await getUserById(payload.userId)

  if (!user || user.status !== 'active') {
    throw new UnauthorizedError('Invalid user')
  }

  return user
}

// Verify role
export function requireRole(user: User, role: 'admin' | 'provider') {
  if (user.role !== role) {
    throw new ForbiddenError('Insufficient permissions')
  }
}
```

### Rate Limiting
```typescript
// Redis-based rate limiting
export async function rateLimit(
  key: string,
  limit: number,
  window: number // seconds
): Promise<boolean> {
  const count = await redis.incr(key)

  if (count === 1) {
    await redis.expire(key, window)
  }

  return count <= limit
}

// Usage in API route
const allowed = await rateLimit(`api:${userId}`, 100, 60) // 100 req/min
if (!allowed) {
  return NextResponse.json(
    { success: false, error: 'Rate limit exceeded' },
    { status: 429 }
  )
}
```

### CSRF Protection
```typescript
// Generate CSRF token
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Verify CSRF token
export function verifyCsrfToken(token: string, expected: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expected)
  )
}

// Middleware for state-changing operations
export async function verifyCsrf(request: NextRequest) {
  if (['POST', 'PATCH', 'DELETE'].includes(request.method)) {
    const token = request.headers.get('x-csrf-token')
    const expected = request.cookies.get('csrf-token')?.value

    if (!token || !expected || !verifyCsrfToken(token, expected)) {
      throw new ForbiddenError('Invalid CSRF token')
    }
  }
}
```

---

## Deployment Architecture

### Docker Compose (Local/Dev)
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://postgres:postgres@db:5432/findmeahotlead
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgis/postgis:16-3.4
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=findmeahotlead
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI

volumes:
  postgres_data:
  redis_data:
```

### Docker Swarm (Staging/Production)
```yaml
version: '3.8'

services:
  app:
    image: registry.example.com/fmhl-app:latest
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://user:pass@db:5432/fmhl
      - REDIS_URL=redis://redis:6379
    networks:
      - app_network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    deploy:
      replicas: 1
    networks:
      - app_network

  db:
    image: postgis/postgis:16-3.4
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=fmhl
    volumes:
      - db_data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
    networks:
      - app_network

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    deploy:
      replicas: 1
    networks:
      - app_network

  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    deploy:
      replicas: 1
    networks:
      - app_network

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    deploy:
      replicas: 1
    networks:
      - app_network

networks:
  app_network:
    driver: overlay

volumes:
  db_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

---

## Monitoring & Observability

### Metrics (Prometheus)
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'app'
    static_configs:
      - targets: ['app:3000']

  - job_name: 'postgres'
    static_configs:
      - targets: ['db:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:9121']
```

### Key Metrics to Track
- **Application**:
  - Request rate (requests/second)
  - Response time (p50, p95, p99)
  - Error rate (%)
  - Active users

- **Business**:
  - Leads submitted (count/hour)
  - Leads distributed (count/hour)
  - Revenue ($/hour)
  - Refunds (count, $)
  - Provider signups (count/day)

- **Database**:
  - Connection pool usage
  - Query duration (p50, p95, p99)
  - Slow queries (>1s)
  - Deadlocks

- **Background Jobs**:
  - Job queue length
  - Job processing time
  - Failed jobs

### Alerts
- **Critical**:
  - App down (no response for 1 minute)
  - Database down
  - Redis down
  - Error rate >5%
  - Disk usage >90%

- **Warning**:
  - Response time p95 >2s
  - Error rate >1%
  - Job queue length >100
  - Disk usage >80%

---

## Backup & Disaster Recovery

### Database Backups
```bash
# Daily full backup (automated via cron)
pg_dump -h localhost -U postgres -d findmeahotlead |   gzip > /backups/fmhl_$(date +%Y%m%d).sql.gz

# Upload to Wasabi
aws s3 cp /backups/fmhl_$(date +%Y%m%d).sql.gz   s3://fmhl-backup/db/   --endpoint-url=https://s3.wasabisys.com

# Retention: 7 daily, 4 weekly, 12 monthly
```

### Point-in-Time Recovery (WAL Archiving)
```bash
# Enable WAL archiving in postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://fmhl-backup/wal/%f --endpoint-url=https://s3.wasabisys.com'
```

### File Backups (TrueNAS → Wasabi)
```bash
# Daily sync (automated via cron)
aws s3 sync s3://fmhl-uploads s3://fmhl-backup/files/   --source-endpoint-url=https://truenas.local:9000   --endpoint-url=https://s3.wasabisys.com
```

### Disaster Recovery Plan
1. **Database Failure**:
   - Restore from latest backup
   - Replay WAL logs for point-in-time recovery
   - RTO: 1 hour, RPO: 15 minutes

2. **Application Failure**:
   - Docker Swarm auto-restarts failed containers
   - If entire node fails, Swarm reschedules on healthy node
   - RTO: 5 minutes

3. **Complete Infrastructure Failure**:
   - Provision new infrastructure
   - Restore database from Wasabi backup
   - Restore files from Wasabi backup
   - Deploy application from Docker registry
   - RTO: 4 hours, RPO: 24 hours

---

## Scalability Considerations

### Horizontal Scaling
- **Application**: Add more Docker Swarm nodes, increase replicas
- **Database**: Read replicas for reporting queries
- **Redis**: Redis Cluster for high availability
- **Background Jobs**: Add more worker nodes

### Vertical Scaling
- **Database**: Increase CPU/RAM for better query performance
- **Redis**: Increase RAM for larger queues

### Caching Strategy
- **Redis**: Cache frequently accessed data (provider balances, competition levels)
- **CDN**: Cache static assets (images, CSS, JS)
- **Browser**: Cache API responses with appropriate headers

### Database Optimization
- **Indexes**: Add indexes for all foreign keys and frequently queried columns
- **Partitioning**: Partition large tables (leads, audit_log) by date
- **Archiving**: Archive old leads (>1 year) to separate table

### Future Microservices Migration
When scale demands it, split into microservices:
1. **Lead Service**: Lead submission, distribution
2. **Provider Service**: Provider management, subscriptions
3. **Payment Service**: Stripe integration, ledger
4. **Notification Service**: Email, SMS, push notifications
5. **Admin Service**: Admin dashboard, reports

---

**End of Architecture Document**
