# Product Requirements Document (PRD)
## Find Me A Hot Lead - Lead Generation & Distribution Platform

**Version:** 1.0  
**Date:** December 27, 2025  
**Status:** MVP Specification  
**Author:** Product Team

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Product Vision & Goals](#product-vision--goals)
3. [User Roles & Personas](#user-roles--personas)
4. [Core Features (MVP)](#core-features-mvp)
5. [User Stories & Acceptance Criteria](#user-stories--acceptance-criteria)
6. [Future Roadmap](#future-roadmap)
7. [Success Metrics](#success-metrics)
8. [Out of Scope (MVP)](#out-of-scope-mvp)

---

## Executive Summary

**Find Me A Hot Lead** is a multi-tenant B2B SaaS marketplace captures user generated sales leads and then connects service providers with those sales leads through a fair, transparent, and scalable distribution system.

### The Problem
- Service providers struggle to grow - not able to find consistent sales leads, many of which don't have the marketin know-how or expertise to grow their business.
- End users waste time contacting multiple providers individually, repeating the same information and not able to find matching service providers for their request. 
- Existing lead generation platforms don't capture the necessary details to provide a quote right away, sell the lead to any buyer (causing SPAM for the end-users), and lack transparency and fairness in distribution
- The risk to generate leads is growing - even marketing experts struggle to generate leads in a feasible manner and cannot guarantee an ROI as major platforms charge per click or motion with no guarantee on results.

### The Solution
A lead generation platform where:
- **End users** submit ONE form with all the necessary details to receive multiple quotes from competing service providers
- **Service providers** subscribe to competition levels, set filters to define what a lead means to them, and receive qualified leads via fair round-robin distribution. Service Providers only pay per lead (real results - not clicks or motion)
- **Platform** generates revenue by capturing user generate leads and selling those leads to service providers that match their sales criteria (as defined by filters), at tiered pricing.
- **Admins** manage niches, form fields, service providers, pricing, and disputes through a comprehensive dashboard and interface

### Key Differentiators
- **Pay for Results**: Service Providers only pay when they receive a sales lead matching their criteria
- **Full Transparency**: Providers know exactly what they will receive given the transparent upfront pricing without any projections or guesswork from other advertising platforms (price per lead), along with how much competition they'll face for each lead (competition levels)
- **Fair Round-Robin Distribution**: Ensures all subscribed providers get equal opportunities
- **Competition Levels**: The ability to choose the level of competition you'll face for each lead along with tiered pricing per lead (less competition means higher price per lead), tailoring the solution to budgets of all sizes.
- **Multi-Level Subscriptions**: Providers can subscribe to multiple competition levels with different filters, allowing them to define different acceptance criteria for each pricing level.
- **API-First Architecture**: Built for future partner integrations and CRM connections 


### Business Model
- **Revenue**: Direct lead sales to service providers (no commission model)
- **Pricing**: Tiered pricing per competition level (admin configurable)
- **Future**: Affiliate/partner referral commissions

---

## Product Vision & Goals

### Vision Statement
"To become the most transparent and fair lead generation platform that empowers service providers with qualified leads while delivering exceptional value to end users seeking multiple competitive quotes."

### Primary Goals (MVP)
1. **Launch with VPS/Server niches** and prove the business model using a digital service that can be sourced and delivered globally
2. **Achieve fair lead distribution** across all subscribed service providers
3. **Provide complete admin control** over niches, forms & fields, pricing, and providers
4. **Ensure financial accuracy** with full audit trails and refund capabilities
5. **Build API-first** to enable future partner integrations

### Secondary Goals (Post-MVP)
1. Expand to location-based niches (plumbers, realtors, dentists)
2. Enable provider bidding (max price + lead qualifications)
3. Build integrated CRM for provider-buyer communication
4. Launch partner/affiliate network with API integrations
5. Implement masked communication for end-user privacy

---

## User Roles & Personas

### 1. End Users (Lead Submitters)
**Who they are:**
- Businesses or individuals seeking services (VPS hosting, plumbing, real estate, etc.)
- Want multiple competitive quotes without contacting providers individually
- Value speed, convenience, and choice

**Goals:**
- Submit request once, receive multiple quotes
- Get responses from qualified, vetted providers
- Compare options and choose the best fit

**Pain Points:**
- Wasting time contacting multiple providers
- Uncertainty about provider quality
- Difficulty comparing options

**MVP Behavior:**
- Fill out public lead submission form
- Receive confirmation email
- Providers contact them directly via email/phone

**Future Behavior:**
- Create account to track lead status
- Communicate with providers through platform CRM
- Block unwanted providers
- Rate/review providers

---

### 2. Service Providers (Lead Buyers)
**Who they are:**
- VPS/hosting companies (MVP), future: local service businesses
- Want consistent flow of qualified leads
- Willing to pay per lead (not per conversion)

**Goals:**
- Receive qualified leads matching their criteria
- Fair distribution (not dominated by competitors)
- Transparent pricing and billing
- Quick notification when leads arrive

**Pain Points:**
- Inconsistent lead flow
- No guarantees with existing marketing spend
- Lack of knowledge or in-house marketing talent to grow the business
- Paying for unqualified or duplicate leads
- Unfair distribution favoring larger competitors
- Hidden fees or unclear pricing

**MVP Behavior:**
- Sign up (email verification + admin approval)
- Add funds to account balance (Stripe)
- Subscribe to competition levels with custom filters
- Receive email notifications for new leads
- Contact leads directly
- Request refunds for bad leads
- View balance, ledger, and lead history

**Future Behavior:**
- Set max price and lead qualifications (bidding)
- Manage leads in built-in CRM
- Integrate with external CRM (HubSpot, Salesforce, etc.)
- Receive leads during active hours only

---

### 3. Admins (Platform Operators)
**Who they are:**
- Platform owners/operators
- Responsible for quality, fairness, and revenue optimization

**Goals:**
- Maintain high lead quality
- Ensure fair distribution
- Maximize revenue through optimal pricing
- Minimize disputes and refunds
- Scale to new niches efficiently

**Pain Points:**
- Manual lead review bottlenecks
- Dispute resolution time
- Balancing provider satisfaction with revenue
- Managing multiple niches with different requirements

**MVP Behavior:**
- Review and approve provider signups
- Review and approve/reject leads before distribution
- Manage competition levels (create, edit, pricing, caps)
- Manage niches and form schemas
- Handle bad lead disputes (approve/reject refunds)
- View analytics (revenue, lead volume, provider activity)
- Manually credit/debit provider accounts
- Configure email templates
- View audit logs

**Future Behavior:**
- Auto-approve providers based on criteria
- Auto-distribute leads (no manual review)
- Manage partner/affiliate network
- Configure automated refund rules
- Advanced analytics and forecasting

---

### 4. Partners/Affiliates (Future)
**Who they are:**
- External websites, agencies, or platforms that generate leads
- Want to monetize their traffic by referring leads

**Goals:**
- Easy integration (API, WordPress plugin, embeddable forms)
- Attribution tracking for their leads
- Commission payments for referred leads
- Performance analytics

**MVP Behavior:**
- Not in MVP scope

**Future Behavior:**
- Register as partner
- Get API credentials
- Submit leads via API or embedded forms
- Track attribution (UTMs, partner IDs)
- View performance reports
- Receive commission payments

---

## Core Features (MVP)

### 1. Lead Submission & Management

#### 1.1 Public Lead Submission Form
**Description:** End users submit lead requests via a public web form.

**Requirements:**
- Dynamic form fields based on niche (VPS: CPU, RAM, storage, bandwidth, location, budget, etc.)
- Form validation (required fields, format checks)
- Anti-spam protection (honeypot, CAPTCHA)
- Attribution tracking:
  - Referrer URL
  - UTM parameters (source, medium, campaign, term, content)
  - Partner/Affiliate ID (future)
  - Click IDs (gclid, fbclid, etc.)
  - Session ID
- Thank you page after submission
- Confirmation email to end user

**Acceptance Criteria:**
- [ ] Form renders with niche-specific fields
- [ ] All required fields validated before submission
- [ ] Attribution data captured and stored
- [ ] Confirmation email sent within 1 minute
- [ ] Thank you page displays with tracking pixel (future)
- [ ] Spam submissions blocked (honeypot catches bots)

---

#### 1.2 Lead Status Workflow
**Description:** Leads progress through defined statuses.

**Statuses:**
1. **Pending Approval**: Submitted, awaiting admin review
2. **Approved**: Admin approved, ready for distribution
3. **Distributed**: Sent to providers
4. **Rejected**: Admin rejected (spam, incomplete, etc.)
5. **Bad Lead**: Marked as bad (global refund)

**Requirements:**
- Status transitions logged in audit trail
- Email notifications on status changes (future)
- Status visible to admin only (providers see "Received" or "Refunded")

**Acceptance Criteria:**
- [ ] Lead starts in "Pending Approval"
- [ ] Admin can approve → "Approved" → triggers distribution
- [ ] Admin can reject → "Rejected" (lead not distributed)
- [ ] Admin can mark as "Bad Lead" → triggers global refunds
- [ ] All status changes logged with timestamp and admin ID

---

#### 1.3 Lead Distribution Engine
**Description:** Fair round-robin distribution across competition levels.

**Algorithm:**
1. Start with Competition Level 1 (highest tier)
2. Filter eligible providers:
   - Subscribed to this competition level
   - Sufficient account balance (≥ lead price for this level)
   - Filter criteria match (location, budget, specs, etc.)
   - Not suspended or on probation
   - Has not already received this lead
3. Sort eligible providers by `last_received_at` (NULL first for new providers)
4. Assign lead to providers up to the max distribution count for this level
5. For each assignment:
   - Deduct lead price from provider balance (atomic transaction)
   - Create ledger entry
   - Create lead assignment record
   - Update `last_received_at` timestamp
   - Send email notification to provider
6. If fewer than max providers received the lead, cascade to next competition level
7. Repeat steps 2-6 for each subsequent level
8. Mark lead as "Distributed"

**Requirements:**
- No provider receives the same lead twice (even across levels)
- Distribution must be atomic (all-or-nothing per provider)
- If provider balance insufficient, skip them (don't fail entire distribution)
- Track which competition level each provider received the lead under
- Providers only see the level they received it under (not other levels)

**Acceptance Criteria:**
- [ ] Lead distributed to eligible providers in round-robin order
- [ ] Providers with insufficient balance skipped
- [ ] No duplicate assignments to same provider
- [ ] Balance deducted atomically with assignment creation
- [ ] Ledger entry created for each assignment
- [ ] Email notification sent to each provider
- [ ] Lead cascades to next level if max not reached
- [ ] Distribution completes within 5 seconds for up to 100 providers

---

### 2. Competition Levels

#### 2.1 Competition Level Configuration
**Description:** Tiered pricing system based on exclusivity.

**Attributes:**
- Name (e.g., "Platinum", "Gold", "Silver", "Bronze")
- Order/Tier position (1 = highest, 4 = lowest)
- Max distribution count (e.g., Platinum = 3 providers, Bronze = 20 providers)
- Price per lead (e.g., Platinum = $50, Bronze = $5)
- Active/Inactive status
- Niche association

**Requirements:**
- Admin can create, edit, delete competition levels
- Admin can adjust pricing and max counts
- Admin can reorder levels
- System respects order when cascading leads
- Inactive levels not available for provider subscription

**Acceptance Criteria:**
- [ ] Admin can create new competition level with all attributes
- [ ] Admin can edit existing level (pricing, max count, name)
- [ ] Admin can deactivate level (existing subscriptions remain, no new subscriptions)
- [ ] Admin can reorder levels (affects cascade logic)
- [ ] Changes take effect immediately for new leads
- [ ] Existing provider subscriptions unaffected by price changes (grandfathered)

---

#### 2.2 Provider Subscription to Competition Levels
**Description:** Providers subscribe to one or more competition levels with custom filters.

**Requirements:**
- Providers can subscribe to multiple levels simultaneously
- Each subscription has independent filter criteria
- Providers can pause/resume subscriptions per level
- Providers can unsubscribe at any time (no refund for unused balance)
- Subscription is free (only charged when lead received)

**Example Use Case:**
- Provider subscribes to:
  - **Platinum** (max $50/lead): Filter for budget ≥ $500/month, managed services only
  - **Gold** (max $20/lead): Filter for budget ≥ $200/month, any management level
  - **Bronze** (max $5/lead): No filters (all leads)

**Acceptance Criteria:**
- [ ] Provider can subscribe to multiple competition levels
- [ ] Provider can set different filters for each level
- [ ] Provider can pause subscription (no new leads, balance retained)
- [ ] Provider can resume subscription
- [ ] Provider can unsubscribe (no refund)
- [ ] Paused subscriptions excluded from distribution
- [ ] Active subscriptions included in round-robin

---

### 3. Provider Management

#### 3.1 Provider Registration & Onboarding
**Description:** Providers sign up and get approved by admin.

**Registration Flow:**
1. Provider fills out signup form:
   - Company name
   - Contact name
   - Email (login)
   - Password
   - Phone
   - Website
2. Email verification link sent
3. Provider verifies email
4. Admin receives notification of new provider
5. Admin reviews and approves/rejects
6. Provider receives approval email
7. Provider logs in and completes profile

**Requirements:**
- Email verification required
- Admin approval required (manual review)
- Provider cannot access platform until approved
- Admin can reject with reason (email sent to provider)

**Acceptance Criteria:**
- [ ] Provider can sign up with required fields
- [ ] Email verification link sent immediately
- [ ] Provider cannot log in until email verified
- [ ] Admin notified of new provider signup
- [ ] Admin can approve/reject with notes
- [ ] Provider receives approval/rejection email
- [ ] Approved provider can log in and access dashboard

---

#### 3.2 Provider Dashboard
**Description:** Central hub for providers to manage leads, balance, and settings.

**Sections:**
1. **Overview**
   - Current balance
   - Leads received (today, this week, this month)
   - Recent leads (last 10)
   - Low balance alert status

2. **Leads**
   - List of all received leads
   - Filters: Date range, competition level, status (active, refunded)
   - Lead details: Contact info, specs, competition level received under
   - Action: Request refund (if within 30 days)

3. **Subscriptions**
   - List of subscribed competition levels
   - Filters for each subscription
   - Pause/Resume/Unsubscribe actions
   - Subscribe to new levels

4. **Balance & Billing**
   - Current balance
   - Add funds (Stripe integration)
   - Transaction history (ledger)
   - Low balance alert settings

5. **Settings**
   - Profile (company name, contact, phone, website)
   - Notification preferences
   - Password change

**Acceptance Criteria:**
- [ ] Dashboard loads within 2 seconds
- [ ] All sections display accurate real-time data
- [ ] Providers can view lead details
- [ ] Providers can request refunds
- [ ] Providers can manage subscriptions
- [ ] Providers can add funds via Stripe
- [ ] Providers can view transaction history

---

#### 3.3 Provider Filters (Per Competition Level)
**Description:** Providers define which leads they want to receive.

**Filter Options (VPS Niche):**
- **Location**: Multi-select (US, EU, Asia, etc.)
- **Budget**: Range slider (min-max monthly budget)
- **Purpose**: Multi-select (Web hosting, Gaming, Development, etc.)
- **CPU**: Multi-select (2 cores, 4 cores, 8+ cores, etc.)
- **RAM**: Multi-select (2GB, 4GB, 8GB, 16GB+, etc.)
- **Storage**: Multi-select (SSD, NVMe, HDD, etc.)
- **Bandwidth**: Multi-select (1TB, 5TB, Unlimited, etc.)
- **IP Addresses**: Multi-select (1 IP, Multiple IPs, Dedicated IP, etc.)
- **Management Level**: Multi-select (Unmanaged, Managed, Fully Managed)

**Requirements:**
- All filters default to "all selected" (receive all leads)
- Providers can deselect options to narrow criteria
- Filters apply only to the specific competition level subscription
- Filter changes take effect immediately for new leads
- Providers can reset filters to default (all selected)

**Acceptance Criteria:**
- [ ] Filter UI displays all niche-specific options
- [ ] All options selected by default
- [ ] Provider can deselect options
- [ ] Filter changes saved immediately
- [ ] Distribution engine respects filters
- [ ] Provider can reset to defaults

---

#### 3.4 Provider Balance & Payments
**Description:** Providers pre-pay for leads via Stripe.

**Requirements:**
- Providers add funds via Stripe (credit card, ACH)
- Minimum deposit: $50 (configurable by admin)
- Balance displayed prominently on dashboard
- Balance deducted automatically when lead assigned
- Balance cannot go negative (providers skipped if insufficient funds)
- Transaction history (ledger) shows all debits and credits
- Low balance alerts:
  - Provider sets threshold amount (e.g., $100)
  - Provider sets alert email address
  - Alert sent once when balance drops below threshold
  - Alert resets when balance goes above threshold

**Acceptance Criteria:**
- [ ] Provider can add funds via Stripe
- [ ] Minimum deposit enforced
- [ ] Balance updates immediately after payment
- [ ] Balance deducted atomically with lead assignment
- [ ] Providers with balance < lead price skipped in distribution
- [ ] Transaction history shows all entries with timestamps
- [ ] Low balance alert sent when threshold crossed
- [ ] Alert sent only once until balance replenished

---

#### 3.5 Provider Notifications
**Description:** Email notifications for key events.

**Notification Types:**
1. **New Lead Received**
   - Subject: "New Lead: [Lead Title]"
   - Body: Lead details, contact info, competition level, price charged
   - CTA: "View Lead" (link to dashboard)
   - Open tracking enabled (future)

2. **Bad Lead Decision**
   - Subject: "Bad Lead Request [Approved/Rejected]: [Lead Title]"
   - Body: Decision, reason, refund amount (if approved)
   - CTA: "View Lead" (link to dashboard)

3. **Low Balance Alert**
   - Subject: "Low Balance Alert: $[Amount] Remaining"
   - Body: Current balance, threshold, CTA to add funds
   - CTA: "Add Funds" (link to billing page)

**Requirements:**
- Providers can toggle each notification type on/off
- Notifications sent within 1 minute of event
- Email templates customizable by admin
- Unsubscribe link in footer (except critical notifications)

**Acceptance Criteria:**
- [ ] New lead notification sent immediately after assignment
- [ ] Bad lead decision notification sent after admin review
- [ ] Low balance alert sent when threshold crossed
- [ ] Providers can toggle notifications in settings
- [ ] Emails use branded templates
- [ ] Unsubscribe link works (updates preferences)

---

### 4. Bad Lead Handling

#### 4.1 Provider-Initiated Bad Lead Request
**Description:** Providers can report bad leads and request refunds.

**Requirements:**
- Providers have 30 days from lead receipt to report
- Provider must select reason:
  - Fake contact info
  - Duplicate lead
  - Spam/Bot submission
  - Wrong niche
  - Other (free text)
- Provider can add notes (optional)
- Request goes to admin for review
- Admin can approve (refund provider) or reject (no refund)
- Admin must add memo when rejecting
- Provider notified of decision via email

**Acceptance Criteria:**
- [ ] Provider can request refund within 30 days
- [ ] Request form requires reason selection
- [ ] Request submitted to admin queue
- [ ] Admin can view all pending requests
- [ ] Admin can approve (refund issued) or reject (memo required)
- [ ] Provider notified of decision
- [ ] Refund credited to provider balance immediately
- [ ] Ledger entry created for refund

---

#### 4.2 Admin-Initiated Global Bad Lead
**Description:** Admin marks entire lead as bad, triggering refunds for all providers.

**Requirements:**
- Admin can mark any lead as "Bad Lead" (global)
- All providers who received this lead automatically refunded
- All pending bad lead requests for this lead auto-resolved as "Approved"
- Refund amount = price paid by each provider at their competition level
- Ledger entries created for all refunds
- Providers notified via email

**Acceptance Criteria:**
- [ ] Admin can mark lead as "Bad Lead"
- [ ] All providers who received lead identified
- [ ] Refunds issued to all providers automatically
- [ ] Pending requests auto-resolved
- [ ] Ledger entries created
- [ ] Providers notified via email
- [ ] Lead status changed to "Bad Lead"

---

#### 4.3 Bad Lead Tracking & Reporting
**Description:** Track bad lead patterns for quality improvement.

**Requirements:**
- Admin can view bad lead statistics:
  - Total bad leads (count, % of total)
  - Bad leads by reason
  - Bad leads by source (UTM, partner, etc.)
  - Bad leads by niche
- Admin can export bad lead report (CSV)
- Patterns used to improve lead quality (future: auto-reject rules)

**Acceptance Criteria:**
- [ ] Admin can view bad lead statistics
- [ ] Statistics accurate and real-time
- [ ] Admin can filter by date range, niche, reason
- [ ] Admin can export to CSV
- [ ] Report includes lead details, reason, refund amount

---

### 5. Admin Dashboard

#### 5.1 Lead Management
**Description:** Admin reviews, approves, and distributes leads.

**Features:**
- **Lead Queue**: List of pending leads
- **Lead Details**: View full lead data, attribution, form responses
- **Actions**:
  - Approve (triggers distribution)
  - Reject (with reason)
  - Edit lead details (if needed)
  - Mark as Bad Lead (global refund)
- **Distribution View**: See which providers received lead and at what level
- **Filters**: Status, niche, date range, source

**Acceptance Criteria:**
- [ ] Admin can view all leads
- [ ] Admin can filter by status, niche, date
- [ ] Admin can approve lead (triggers distribution)
- [ ] Admin can reject lead (with reason)
- [ ] Admin can edit lead details
- [ ] Admin can mark as Bad Lead
- [ ] Admin can view distribution breakdown per lead

---

#### 5.2 Provider Management
**Description:** Admin manages provider accounts and subscriptions.

**Features:**
- **Provider List**: All providers with status, balance, subscriptions
- **Provider Details**:
  - Profile info
  - Balance and ledger
  - Subscriptions and filters
  - Leads received
  - Bad lead requests
- **Actions**:
  - Approve/Reject signup
  - Activate/Deactivate account
  - Manually credit/debit balance (with memo)
  - View/Edit subscriptions
  - Send invite email
- **Filters**: Status (pending, active, deactivated), balance range, subscription level

**Acceptance Criteria:**
- [ ] Admin can view all providers
- [ ] Admin can filter by status, balance, subscription
- [ ] Admin can approve/reject signups
- [ ] Admin can activate/deactivate accounts
- [ ] Admin can manually adjust balance (with memo)
- [ ] Admin can view provider ledger
- [ ] Admin can view provider leads
- [ ] Admin can send invite emails

---

#### 5.3 Competition Level Management
**Description:** Admin configures competition levels for each niche.

**Features:**
- **Competition Level List**: All levels with name, order, price, max count, status
- **Actions**:
  - Create new level
  - Edit existing level (name, price, max count)
  - Reorder levels (drag-and-drop or up/down arrows)
  - Activate/Deactivate level
  - Delete level (only if no active subscriptions)
- **Preview**: See how changes affect distribution logic

**Acceptance Criteria:**
- [ ] Admin can create new competition level
- [ ] Admin can edit level attributes
- [ ] Admin can reorder levels
- [ ] Admin can activate/deactivate levels
- [ ] Admin can delete levels (with validation)
- [ ] Changes take effect immediately
- [ ] Preview shows distribution logic

---

#### 5.4 Niche Management
**Description:** Admin creates and manages niches with dynamic form schemas.

**Features:**
- **Niche List**: All niches with name, status, lead count
- **Niche Details**:
  - Name, description, slug
  - Form schema (fields, types, options, validation)
  - Competition levels
  - Default starting competition level
- **Form Schema Editor**:
  - Add/Remove fields
  - Edit field properties (label, type, required, options)
  - Reorder fields
  - Preview form
  - Version history (schema versioning)
- **Actions**:
  - Create new niche
  - Edit niche details
  - Activate/Deactivate niche
  - Clone niche (for similar niches)

**Acceptance Criteria:**
- [ ] Admin can create new niche
- [ ] Admin can edit niche details
- [ ] Admin can add/remove form fields
- [ ] Admin can edit field properties
- [ ] Admin can reorder fields
- [ ] Admin can preview form
- [ ] Form schema versioned (backward compatible)
- [ ] Admin can activate/deactivate niche
- [ ] Admin can clone niche

---

#### 5.5 Bad Lead Request Management
**Description:** Admin reviews and resolves bad lead requests.

**Features:**
- **Request Queue**: List of pending requests
- **Request Details**:
  - Lead info
  - Provider info
  - Reason and notes
  - Request date
- **Actions**:
  - Approve (issue refund)
  - Reject (with memo)
  - View lead details
  - View provider history (past bad lead requests)
- **Filters**: Status (pending, approved, rejected), date range, provider, reason

**Acceptance Criteria:**
- [ ] Admin can view all bad lead requests
- [ ] Admin can filter by status, date, provider, reason
- [ ] Admin can approve request (refund issued)
- [ ] Admin can reject request (memo required)
- [ ] Admin can view lead and provider details
- [ ] Admin can view provider's bad lead history
- [ ] Decisions logged in audit trail

---

#### 5.6 Billing & Payments
**Description:** Admin views payment transactions and manages payment settings.

**Features:**
- **Payment Log**: All deposits from providers
- **Transaction Details**:
  - Provider
  - Amount
  - Payment method
  - Status (pending, completed, failed)
  - Timestamp
- **Filters**: Date range, provider, status, amount range
- **Export**: CSV export
- **Payment Gateway Settings**:
  - Stripe API keys
  - Minimum deposit amount
  - Accepted payment methods

**Acceptance Criteria:**
- [ ] Admin can view all payment transactions
- [ ] Admin can filter by date, provider, status
- [ ] Admin can export to CSV
- [ ] Admin can configure payment gateway settings
- [ ] Admin can set minimum deposit amount

---

#### 5.7 Reporting & Analytics
**Description:** Admin views platform performance metrics.

**Reports:**
1. **Revenue Report**
   - Total revenue (all time, this month, this week, today)
   - Revenue by niche
   - Revenue by competition level
   - Revenue trend (chart)

2. **Refund Report**
   - Total refunds (count, amount)
   - Refund rate (% of revenue)
   - Refunds by reason
   - Refunds by niche

3. **Lead Volume Report**
   - Total leads (all time, this month, this week, today)
   - Leads by status (pending, approved, distributed, rejected, bad)
   - Leads by niche
   - Lead trend (chart)

4. **Provider Performance Report**
   - Total providers (active, inactive, pending)
   - Providers by subscription level
   - Top providers by spend
   - Provider churn rate

5. **Attribution Report**
   - Leads by source (UTM source, medium, campaign)
   - Leads by referrer
   - Leads by partner (future)
   - Conversion rate by source

**Requirements:**
- All reports support date range filtering
- All reports exportable to CSV
- Charts interactive (hover for details)
- Real-time data (no caching delays)

**Acceptance Criteria:**
- [ ] Admin can view all reports
- [ ] Admin can filter by date range
- [ ] Admin can export to CSV
- [ ] Charts display correctly
- [ ] Data accurate and real-time

---

#### 5.8 Email Template Management
**Description:** Admin customizes system email templates.

**Templates:**
1. Lead Confirmation (to end user)
2. New Lead Notification (to provider)
3. Bad Lead Decision (to provider)
4. Low Balance Alert (to provider)
5. Provider Approval (to provider)
6. Provider Rejection (to provider)
7. Provider Invite (to provider)

**Features:**
- **Template Editor**:
  - Subject line
  - Body (HTML editor with variables)
  - Preview
  - Send test email
- **Variables**: Dynamic placeholders (e.g., {{provider_name}}, {{lead_title}}, {{balance}})
- **Version History**: Track template changes

**Acceptance Criteria:**
- [ ] Admin can view all email templates
- [ ] Admin can edit subject and body
- [ ] Admin can preview template
- [ ] Admin can send test email
- [ ] Variables replaced correctly in sent emails
- [ ] Template changes take effect immediately

---

#### 5.9 System Settings
**Description:** Admin configures platform-wide settings.

**Settings:**
1. **General**
   - Platform name
   - Support email
   - Timezone
   - Currency

2. **Anti-Spam**
   - Enable honeypot
   - Enable CAPTCHA (reCAPTCHA v3)
   - CAPTCHA threshold score

3. **Conversion Tracking**
   - Thank you page tracking pixel
   - Google Analytics ID
   - Facebook Pixel ID

4. **Partner/Affiliate** (Future)
   - Enable partner network
   - Default commission rate
   - Allowed domains for embeddable forms

5. **Email**
   - SMTP settings (Amazon SES)
   - From email address
   - From name
   - Open tracking domain

**Acceptance Criteria:**
- [ ] Admin can edit all settings
- [ ] Settings saved and applied immediately
- [ ] Validation for required fields
- [ ] Test buttons for email and tracking

---

#### 5.10 Audit Log
**Description:** Track all critical actions for compliance and debugging.

**Logged Events:**
- Lead approvals, rejections, distributions
- Refund decisions (provider-initiated and global)
- Provider balance changes (manual credits/debits)
- Competition level edits
- Niche and form schema changes
- Email template edits
- Provider account changes (approval, deactivation)
- Admin login sessions (optional)

**Log Entry Fields:**
- Timestamp
- Actor (admin user ID)
- Action type
- Entity type (lead, provider, competition level, etc.)
- Entity ID
- Description (human-readable)
- Metadata (JSON with details)

**Acceptance Criteria:**
- [ ] All critical actions logged
- [ ] Admin can view audit log
- [ ] Admin can filter by date, actor, action type, entity
- [ ] Admin can export to CSV
- [ ] Log entries immutable (cannot be edited or deleted)

---

### 6. API-First Architecture

#### 6.1 RESTful API Design
**Description:** All functionality exposed via REST API.

**Requirements:**
- All admin, provider, and lead submission actions accessible via API
- Consistent response structure:
  - Success: `{ success: true, data: {...} }`
  - Error: `{ success: false, error: "message", details: {...} }`
- Proper HTTP status codes (200, 201, 400, 401, 403, 404, 409, 500)
- JWT authentication for protected endpoints
- Rate limiting (100 requests/minute per user)
- API versioning (v1, v2, etc.)
- Comprehensive API documentation (Swagger/OpenAPI)

**Acceptance Criteria:**
- [ ] All features accessible via API
- [ ] Consistent response structure
- [ ] Proper HTTP status codes
- [ ] JWT authentication works
- [ ] Rate limiting enforced
- [ ] API documentation complete and accurate

---

#### 6.2 Partner Lead Submission (Future)
**Description:** External partners submit leads via API or embedded forms.

**Requirements:**
- Partner registration and API key generation
- API endpoint for lead submission with partner_id
- WordPress plugin for embedded forms
- JavaScript embeddable forms (iframe or widget)
- Attribution tracking (partner_id, UTMs)
- Partner-specific reporting
- Commission tracking (future)

**Acceptance Criteria:**
- Not in MVP scope

---

### 7. Financial System

#### 7.1 Provider Ledger
**Description:** Complete audit trail of all financial transactions.

**Ledger Entry Types:**
- **Deposit**: Provider adds funds
- **Lead Purchase**: Balance deducted for lead assignment
- **Refund**: Balance credited for bad lead
- **Manual Credit**: Admin adds funds (with memo)
- **Manual Debit**: Admin removes funds (with memo)

**Ledger Entry Fields:**
- ID (UUID)
- Provider ID
- Subscription ID (if applicable)
- Lead ID (if applicable)
- Transaction type
- Amount (positive for credits, negative for debits)
- Balance after transaction
- Memo (optional, required for manual adjustments)
- Created at
- Created by (admin ID for manual adjustments)

**Requirements:**
- All balance changes recorded in ledger
- Ledger entries immutable (cannot be edited or deleted)
- Balance calculated from ledger (not stored separately)
- Providers can view their ledger
- Admin can view all ledgers

**Acceptance Criteria:**
- [ ] All balance changes create ledger entry
- [ ] Ledger entries immutable
- [ ] Balance calculated correctly from ledger
- [ ] Providers can view their ledger
- [ ] Admin can view all ledgers
- [ ] Ledger export to CSV

---

#### 7.2 Stripe Integration
**Description:** Payment processing via Stripe.

**Requirements:**
- Stripe Checkout for deposits
- Minimum deposit amount enforced
- Payment confirmation webhook
- Payment status tracking (pending, completed, failed)
- Refund capability (for bad leads)
- PCI compliance (Stripe handles card data)

**Acceptance Criteria:**
- [ ] Provider can add funds via Stripe Checkout
- [ ] Minimum deposit enforced
- [ ] Payment webhook updates balance immediately
- [ ] Failed payments handled gracefully
- [ ] Refunds processed correctly
- [ ] No card data stored on platform

---

### 8. Security & Compliance

#### 8.1 Authentication & Authorization
**Requirements:**
- JWT tokens with 7-day expiry
- bcrypt password hashing (cost factor 10)
- Email verification required for signup
- Rate limiting on auth endpoints (10 requests/minute)
- Role-based access control (admin, provider)
- Session management (logout invalidates token)

**Acceptance Criteria:**
- [ ] JWT authentication works
- [ ] Passwords hashed with bcrypt
- [ ] Email verification required
- [ ] Rate limiting enforced
- [ ] RBAC enforced on all endpoints
- [ ] Logout invalidates token

---

#### 8.2 Data Protection
**Requirements:**
- HTTPS only in production
- Environment variables for all secrets
- SQL injection prevention (parameterized queries)
- XSS prevention (React escaping + CSP headers)
- CSRF protection for state-changing operations
- Data encryption at rest (database encryption)
- Data encryption in transit (TLS 1.3)

**Acceptance Criteria:**
- [ ] HTTPS enforced in production
- [ ] No secrets in code
- [ ] Parameterized queries used
- [ ] CSP headers set
- [ ] CSRF tokens validated
- [ ] Database encrypted
- [ ] TLS 1.3 used

---

#### 8.3 Privacy & GDPR Compliance (Future)
**Requirements:**
- Privacy policy and terms of service
- Cookie consent banner
- Data export (providers can download their data)
- Data deletion (providers can request account deletion)
- Data retention policy (leads deleted after X years)

**Acceptance Criteria:**
- Not in MVP scope (but design with GDPR in mind)

---

## User Stories & Acceptance Criteria

### End User Stories

**US-1: Submit Lead Request**
- **As an** end user
- **I want to** submit a lead request via a web form
- **So that** I can receive multiple quotes from service providers

**Acceptance Criteria:**
- [ ] Form displays with niche-specific fields
- [ ] All required fields validated
- [ ] Form submits successfully
- [ ] Confirmation email received within 1 minute
- [ ] Thank you page displayed

---

**US-2: Receive Confirmation**
- **As an** end user
- **I want to** receive a confirmation email after submitting my request
- **So that** I know my request was received

**Acceptance Criteria:**
- [ ] Email sent within 1 minute of submission
- [ ] Email contains request summary
- [ ] Email contains next steps (expect provider contact)

---

### Service Provider Stories

**US-3: Sign Up as Provider**
- **As a** service provider
- **I want to** sign up for an account
- **So that** I can receive leads

**Acceptance Criteria:**
- [ ] Signup form displays with required fields
- [ ] Email verification link sent
- [ ] Email verified successfully
- [ ] Admin notified of new signup
- [ ] Approval email received after admin approval
- [ ] Can log in after approval

---

**US-4: Subscribe to Competition Level**
- **As a** service provider
- **I want to** subscribe to one or more competition levels
- **So that** I can receive leads matching my criteria

**Acceptance Criteria:**
- [ ] Can view all available competition levels
- [ ] Can subscribe to multiple levels
- [ ] Can set different filters for each level
- [ ] Subscription saved successfully
- [ ] Included in distribution for subscribed levels

---

**US-5: Receive Lead Notification**
- **As a** service provider
- **I want to** receive an email notification when a new lead is assigned to me
- **So that** I can contact the lead quickly

**Acceptance Criteria:**
- [ ] Email sent within 1 minute of assignment
- [ ] Email contains lead details and contact info
- [ ] Email contains competition level and price charged
- [ ] Email contains link to view lead in dashboard

---

**US-6: View Lead Details**
- **As a** service provider
- **I want to** view lead details in my dashboard
- **So that** I can review the request and contact the lead

**Acceptance Criteria:**
- [ ] Lead details displayed accurately
- [ ] Contact info visible
- [ ] Competition level displayed
- [ ] Price charged displayed
- [ ] Can request refund (if within 30 days)

---

**US-7: Add Funds to Account**
- **As a** service provider
- **I want to** add funds to my account balance
- **So that** I can receive leads

**Acceptance Criteria:**
- [ ] Can access billing page
- [ ] Can enter deposit amount (≥ minimum)
- [ ] Stripe Checkout opens
- [ ] Payment processed successfully
- [ ] Balance updated immediately
- [ ] Ledger entry created

---

**US-8: Request Refund for Bad Lead**
- **As a** service provider
- **I want to** request a refund for a bad lead
- **So that** I don't pay for low-quality leads

**Acceptance Criteria:**
- [ ] Can request refund within 30 days
- [ ] Must select reason
- [ ] Can add notes
- [ ] Request submitted successfully
- [ ] Notification received when admin decides
- [ ] Refund credited if approved

---

**US-9: Set Low Balance Alert**
- **As a** service provider
- **I want to** set a low balance alert
- **So that** I'm notified when my balance is running low

**Acceptance Criteria:**
- [ ] Can set threshold amount
- [ ] Can set alert email address
- [ ] Alert sent when balance drops below threshold
- [ ] Alert sent only once until balance replenished

---

**US-10: Pause Subscription**
- **As a** service provider
- **I want to** pause my subscription to a competition level
- **So that** I don't receive leads temporarily

**Acceptance Criteria:**
- [ ] Can pause subscription
- [ ] No new leads received while paused
- [ ] Balance retained
- [ ] Can resume subscription
- [ ] Included in distribution after resume

---

### Admin Stories

**US-11: Approve Lead**
- **As an** admin
- **I want to** review and approve leads
- **So that** only quality leads are distributed

**Acceptance Criteria:**
- [ ] Can view pending leads
- [ ] Can view lead details
- [ ] Can approve lead
- [ ] Lead distributed immediately after approval
- [ ] Lead status changed to "Distributed"

---

**US-12: Reject Lead**
- **As an** admin
- **I want to** reject low-quality leads
- **So that** providers don't receive spam

**Acceptance Criteria:**
- [ ] Can reject lead
- [ ] Must provide reason
- [ ] Lead status changed to "Rejected"
- [ ] Lead not distributed

---

**US-13: Approve Provider Signup**
- **As an** admin
- **I want to** approve provider signups
- **So that** only legitimate businesses can receive leads

**Acceptance Criteria:**
- [ ] Can view pending provider signups
- [ ] Can view provider details
- [ ] Can approve provider
- [ ] Provider receives approval email
- [ ] Provider can log in

---

**US-14: Create Competition Level**
- **As an** admin
- **I want to** create competition levels
- **So that** I can offer tiered pricing

**Acceptance Criteria:**
- [ ] Can create new competition level
- [ ] Can set name, order, price, max count
- [ ] Competition level available for provider subscription
- [ ] Distribution engine respects new level

---

**US-15: Adjust Competition Level Pricing**
- **As an** admin
- **I want to** adjust competition level pricing
- **So that** I can optimize revenue

**Acceptance Criteria:**
- [ ] Can edit competition level price
- [ ] Price change takes effect immediately for new leads
- [ ] Existing provider subscriptions unaffected (grandfathered)

---

**US-16: Review Bad Lead Request**
- **As an** admin
- **I want to** review bad lead requests
- **So that** I can decide whether to issue refunds

**Acceptance Criteria:**
- [ ] Can view pending bad lead requests
- [ ] Can view lead and provider details
- [ ] Can approve (refund issued) or reject (memo required)
- [ ] Provider notified of decision
- [ ] Ledger entry created for refund

---

**US-17: Mark Lead as Global Bad Lead**
- **As an** admin
- **I want to** mark a lead as globally bad
- **So that** all providers who received it are refunded

**Acceptance Criteria:**
- [ ] Can mark lead as "Bad Lead"
- [ ] All providers who received lead refunded automatically
- [ ] Pending bad lead requests auto-resolved
- [ ] Providers notified
- [ ] Ledger entries created

---

**US-18: View Revenue Report**
- **As an** admin
- **I want to** view revenue reports
- **So that** I can track platform performance

**Acceptance Criteria:**
- [ ] Can view total revenue
- [ ] Can filter by date range, niche, competition level
- [ ] Can view revenue trend chart
- [ ] Can export to CSV

---

**US-19: Manage Niche Form Schema**
- **As an** admin
- **I want to** add/remove form fields for a niche
- **So that** I can customize lead requests

**Acceptance Criteria:**
- [ ] Can add new field
- [ ] Can edit field properties
- [ ] Can remove field
- [ ] Can reorder fields
- [ ] Form schema versioned
- [ ] Changes take effect immediately for new leads

---

**US-20: Manually Adjust Provider Balance**
- **As an** admin
- **I want to** manually credit or debit a provider's balance
- **So that** I can handle special cases (refunds, bonuses, corrections)

**Acceptance Criteria:**
- [ ] Can credit or debit balance
- [ ] Must provide memo
- [ ] Balance updated immediately
- [ ] Ledger entry created
- [ ] Provider notified (optional)

---

## Future Roadmap

### Phase 2: Enhanced Provider Experience (Post-MVP)
- **Active Hours**: Providers set working hours, only receive leads during those times
- **Provider Bidding**: Providers set max price and lead qualifications (dynamic pricing)
- **Auto-Approval**: Providers auto-approved based on criteria (no manual review)
- **Provider Ratings**: End users rate providers, ratings displayed on provider profiles
- **Provider Profiles**: Public profiles with reviews, portfolio, certifications

### Phase 3: End User Experience (Post-MVP)
- **End User Accounts**: End users create accounts to track lead status
- **Masked Communication**: End users opt to hide email, communicate via platform
- **Provider Blocking**: End users block unwanted providers
- **Lead Status Tracking**: End users see which providers viewed/responded to their lead
- **Provider Selection**: End users mark which provider they chose (close loop)

### Phase 4: Built-In CRM (Post-MVP)
- **Lead Pipeline**: Providers manage leads through stages (New → Contacted → Negotiating → Won/Lost)
- **Internal Notes**: Providers add private notes to leads
- **Communication History**: Track all emails/calls with end users
- **Follow-Up Reminders**: Automated reminders for follow-ups
- **Task Management**: Create tasks for lead follow-up

### Phase 5: External CRM Integrations (Post-MVP)
- **HubSpot Integration**: Sync leads to HubSpot
- **Salesforce Integration**: Sync leads to Salesforce
- **Pipedrive Integration**: Sync leads to Pipedrive
- **Zoho Integration**: Sync leads to Zoho
- **Webhook Support**: Send lead data to any CRM via webhooks

### Phase 6: Partner/Affiliate Network (Post-MVP)
- **Partner Registration**: External partners sign up
- **API Access**: Partners submit leads via API
- **WordPress Plugin**: Embeddable forms for WordPress sites
- **JavaScript Widget**: Embeddable forms for any website
- **Attribution Tracking**: Track leads by partner, UTMs, click IDs
- **Commission Payments**: Pay partners for referred leads
- **Partner Dashboard**: Partners view performance, earnings, analytics

### Phase 7: Location-Based Niches (Post-MVP)
- **Geographic Matching**: Match providers by radius, city, state, zip
- **Service Area Management**: Providers define service areas
- **Map View**: End users see providers on map
- **Local SEO**: Optimize for local search (e.g., "plumbers near me")

### Phase 8: Advanced Analytics & AI (Post-MVP)
- **Lead Quality Scoring**: AI predicts lead quality before distribution
- **Provider Performance Prediction**: AI predicts which providers will convert
- **Dynamic Pricing**: AI adjusts pricing based on demand/supply
- **Fraud Detection**: AI detects fake leads and bad actors
- **Churn Prediction**: AI predicts which providers will churn

---

## Success Metrics

### MVP Success Criteria (First 90 Days)
1. **Lead Volume**: 500+ leads submitted
2. **Provider Acquisition**: 50+ active providers
3. **Revenue**: $10,000+ in lead sales
4. **Lead Quality**: <10% bad lead rate
5. **Provider Satisfaction**: >80% provider retention (no churn)
6. **Distribution Fairness**: All providers receive leads within 7 days of subscription
7. **System Uptime**: 99.5%+ uptime
8. **Response Time**: <2 seconds for all pages

### Key Performance Indicators (KPIs)
- **Lead Metrics**:
  - Leads submitted per day
  - Lead approval rate (% approved vs rejected)
  - Bad lead rate (% of leads marked as bad)
  - Lead distribution time (time from approval to distribution)

- **Provider Metrics**:
  - Active providers (subscribed to at least one level)
  - Provider churn rate (% of providers who unsubscribe)
  - Average balance per provider
  - Leads per provider per month
  - Provider satisfaction score (survey)

- **Financial Metrics**:
  - Monthly Recurring Revenue (MRR)
  - Average Revenue Per Provider (ARPP)
  - Refund rate (% of revenue refunded)
  - Customer Acquisition Cost (CAC)
  - Lifetime Value (LTV)

- **Platform Metrics**:
  - System uptime (%)
  - Average page load time (seconds)
  - API response time (milliseconds)
  - Error rate (% of requests with errors)

---

## Out of Scope (MVP)

The following features are **NOT** included in the MVP and will be considered for future releases:

1. **Active Hours**: Providers set working hours (future)
2. **Provider Bidding**: Dynamic pricing based on provider bids (future)
3. **Auto-Approval**: Automatic provider approval (future)
4. **End User Accounts**: End users create accounts (future)
5. **Masked Communication**: Hide end user email, communicate via platform (future)
6. **Provider Blocking**: End users block providers (future)
7. **Built-In CRM**: Lead pipeline, notes, tasks (future)
8. **External CRM Integrations**: HubSpot, Salesforce, etc. (future)
9. **Partner/Affiliate Network**: API, WordPress plugin, commissions (future)
10. **Location-Based Niches**: Geographic matching, service areas (future)
11. **Provider Ratings**: End user ratings and reviews (future)
12. **Provider Profiles**: Public profiles with portfolio (future)
13. **Lead Status Tracking**: End users see provider responses (future)
14. **Advanced Analytics**: AI-powered insights (future)
15. **Mobile Apps**: iOS/Android apps (future)
16. **Multi-Language Support**: Internationalization (future)
17. **White-Label**: Rebrandable platform for partners (future)

---

## Appendix

### A. Glossary
- **Lead**: A request submitted by an end user seeking services
- **Service Provider**: A business that pays to receive leads
- **Competition Level**: A tier in the pricing structure (e.g., Platinum, Gold, Silver, Bronze)
- **Round-Robin**: Fair distribution algorithm that rotates through providers
- **Bad Lead**: A lead marked as low-quality (fake, duplicate, spam)
- **Niche**: A category of services (e.g., VPS hosting, plumbing, real estate)
- **Form Schema**: The structure and fields of a lead submission form
- **Attribution**: Tracking data for lead sources (UTMs, referrer, partner ID)
- **Ledger**: Complete transaction history for a provider's balance

### B. Assumptions
- Providers are willing to pay per lead (not per conversion)
- End users prefer submitting one form over contacting multiple providers
- Fair distribution is more important than speed-to-lead
- Admin review of leads is acceptable for MVP (auto-distribution in future)
- Email is the primary communication channel (CRM integration in future)

### C. Risks & Mitigation
1. **Risk**: Low lead quality (spam, bots)
   - **Mitigation**: Honeypot, CAPTCHA, admin review, bad lead refunds

2. **Risk**: Provider churn due to unfair distribution
   - **Mitigation**: Round-robin algorithm, transparent reporting, low balance alerts

3. **Risk**: Insufficient provider supply for leads
   - **Mitigation**: Cascade to lower competition levels, provider recruitment campaigns

4. **Risk**: Payment fraud (stolen cards, chargebacks)
   - **Mitigation**: Stripe fraud detection, minimum deposit, manual review for large deposits

5. **Risk**: System downtime during lead distribution
   - **Mitigation**: High availability architecture, automated failover, monitoring/alerts

### D. Open Questions
1. What is the ideal max distribution count for each competition level?
2. Should we allow providers to set max leads per day/week/month?
3. Should we offer volume discounts (e.g., buy 100 leads, get 10% off)?
4. Should we allow providers to "preview" leads before accepting (with time limit)?
5. Should we implement a "lead marketplace" where providers bid on leads in real-time?

---

**End of PRD**
