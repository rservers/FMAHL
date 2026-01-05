-- Enable PostGIS extension for location data
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- USERS & AUTHENTICATION (EPIC 01)
-- ============================================

-- User roles including system actor for background jobs
CREATE TYPE user_role AS ENUM ('admin', 'provider', 'end_user', 'system');

-- User account status for access control
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'deactivated');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'end_user',
  status user_status NOT NULL DEFAULT 'pending',
  
  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  
  -- Email verification (EPIC 01)
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verification_token_hash VARCHAR(255),
  email_verification_expires_at TIMESTAMPTZ,
  
  -- Password reset (EPIC 01)
  password_reset_token_hash VARCHAR(255),
  password_reset_expires_at TIMESTAMPTZ,
  
  -- MFA for admin accounts (EPIC 01)
  mfa_secret VARCHAR(255),
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- Token lookup indexes (partial indexes for non-null values)
CREATE INDEX idx_users_email_verification_token_hash 
  ON users(email_verification_token_hash) 
  WHERE email_verification_token_hash IS NOT NULL;

CREATE INDEX idx_users_password_reset_token_hash 
  ON users(password_reset_token_hash) 
  WHERE password_reset_token_hash IS NOT NULL;

-- ============================================
-- AUDIT LOG (EPIC 01)
-- ============================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(20),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(50),
  entity_id UUID,
  metadata JSONB,
  admin_only_memo TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log indexes
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- ============================================
-- EMAIL INFRASTRUCTURE (EPIC 10)
-- ============================================

-- Versioned email templates with variable metadata
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(100) UNIQUE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB NOT NULL DEFAULT '[]', -- array of variable descriptors
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email delivery lifecycle events
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(100) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (
    event_type IN ('queued', 'sent', 'delivered', 'opened', 'bounced', 'complained', 'failed')
  ),
  provider VARCHAR(50),
  message_id VARCHAR(255),
  template_id UUID REFERENCES email_templates(id),
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email indexes for lookups and recent activity
CREATE INDEX idx_email_templates_key_active ON email_templates(template_key, is_active);
CREATE INDEX idx_email_events_entity ON email_events(related_entity_type, related_entity_id);
CREATE INDEX idx_email_events_created ON email_events(created_at DESC);
CREATE INDEX idx_email_events_recipient ON email_events(recipient_email);

-- ============================================
-- NICHES (Service Categories)
-- ============================================

CREATE TABLE niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_location_based BOOLEAN NOT NULL DEFAULT false,
  lead_price_cents INTEGER NOT NULL,
  form_schema JSONB NOT NULL,
  active_schema_version INTEGER NOT NULL DEFAULT 1,
  -- EPIC 06: Starting level rotation pointer for fair distribution
  next_start_level_order_position INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_niches_slug ON niches(slug);
CREATE INDEX idx_niches_is_active ON niches(is_active);

-- ============================================
-- NICHE FORM SCHEMAS (Versioning)
-- ============================================

CREATE TABLE niche_form_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  schema_definition JSONB NOT NULL,
  change_summary TEXT,
  migration_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(niche_id, version)
);

CREATE INDEX idx_niche_form_schemas_niche ON niche_form_schemas(niche_id);
CREATE INDEX idx_niche_form_schemas_active ON niche_form_schemas(niche_id, is_active);

-- ============================================
-- COMPETITION LEVELS (EPIC 04)
-- ============================================

CREATE TABLE competition_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_per_lead_cents INTEGER NOT NULL CHECK (price_per_lead_cents >= 0),
  max_recipients INTEGER NOT NULL CHECK (max_recipients > 0 AND max_recipients <= 100),
  order_position INTEGER NOT NULL CHECK (order_position >= 1),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique constraints (only for non-deleted)
CREATE UNIQUE INDEX idx_competition_levels_name_unique 
  ON competition_levels(niche_id, name) 
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_competition_levels_order_unique 
  ON competition_levels(niche_id, order_position) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_competition_levels_niche ON competition_levels(niche_id);
CREATE INDEX idx_competition_levels_active ON competition_levels(niche_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_competition_levels_order ON competition_levels(niche_id, order_position) WHERE deleted_at IS NULL;

-- ============================================
-- COMPETITION LEVEL SUBSCRIPTIONS (EPIC 04)
-- ============================================

CREATE TABLE competition_level_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  competition_level_id UUID NOT NULL REFERENCES competition_levels(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deactivation_reason VARCHAR(255),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  -- EPIC 05: Filter fields
  filter_rules JSONB,
  filter_updated_at TIMESTAMPTZ,
  filter_is_valid BOOLEAN NOT NULL DEFAULT true
);

-- Provider can only subscribe once per level (when not deleted)
CREATE UNIQUE INDEX idx_cls_provider_level_unique 
  ON competition_level_subscriptions(provider_id, competition_level_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_cls_provider ON competition_level_subscriptions(provider_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cls_level ON competition_level_subscriptions(competition_level_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cls_active ON competition_level_subscriptions(competition_level_id, is_active) WHERE deleted_at IS NULL;

-- EPIC 05: Filter-related indexes
CREATE INDEX idx_cls_filter_updated ON competition_level_subscriptions(filter_updated_at DESC) WHERE filter_rules IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_cls_filter_invalid ON competition_level_subscriptions(filter_is_valid) WHERE filter_is_valid = false AND deleted_at IS NULL;
CREATE INDEX idx_cls_filter_rules_gin ON competition_level_subscriptions USING GIN (filter_rules) WHERE filter_rules IS NOT NULL;

-- ============================================
-- SUBSCRIPTION FILTER LOGS (EPIC 05)
-- ============================================

CREATE TABLE subscription_filter_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES competition_level_subscriptions(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('admin', 'provider', 'system')),
  old_filter_rules JSONB,
  new_filter_rules JSONB,
  admin_only_memo TEXT,
  memo_updated_at TIMESTAMPTZ,
  memo_updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_filter_logs_subscription_created
  ON subscription_filter_logs(subscription_id, created_at DESC);

CREATE INDEX idx_subscription_filter_logs_actor
  ON subscription_filter_logs(actor_id, created_at DESC);

CREATE INDEX idx_subscription_filter_logs_memo_fts
  ON subscription_filter_logs USING GIN (to_tsvector('english', admin_only_memo))
  WHERE admin_only_memo IS NOT NULL;

-- ============================================
-- PROVIDERS
-- ============================================

CREATE TYPE provider_status AS ENUM ('pending', 'active', 'suspended', 'inactive');

CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE RESTRICT,
  business_name VARCHAR(255) NOT NULL,
  business_phone VARCHAR(20),
  business_email VARCHAR(255),
  website_url VARCHAR(500),
  status provider_status NOT NULL DEFAULT 'pending',
  stripe_customer_id VARCHAR(255),
  -- EPIC 07: Balance fields
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  low_balance_threshold DECIMAL(10,2),
  low_balance_alert_sent BOOLEAN DEFAULT FALSE,
  auto_topup_enabled BOOLEAN DEFAULT FALSE,
  auto_topup_threshold DECIMAL(10,2),
  auto_topup_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, niche_id)
);

CREATE INDEX idx_providers_user ON providers(user_id);
CREATE INDEX idx_providers_niche ON providers(niche_id);
CREATE INDEX idx_providers_status ON providers(status);

-- ============================================
-- PROVIDER SUBSCRIPTIONS
-- ============================================

CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'cancelled', 'expired');

CREATE TABLE provider_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  status subscription_status NOT NULL DEFAULT 'active',
  balance_cents INTEGER NOT NULL DEFAULT 0,
  low_balance_threshold_cents INTEGER NOT NULL DEFAULT 5000,
  auto_recharge_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_recharge_amount_cents INTEGER,
  active_hours JSONB,
  last_received_at TIMESTAMPTZ,
  probation_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id)
);

CREATE INDEX idx_provider_subscriptions_provider ON provider_subscriptions(provider_id);
CREATE INDEX idx_provider_subscriptions_status ON provider_subscriptions(status);
CREATE INDEX idx_provider_subscriptions_last_received ON provider_subscriptions(last_received_at NULLS FIRST);

-- ============================================
-- PROVIDER FILTERS
-- ============================================

CREATE TABLE provider_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  schema_id UUID REFERENCES niche_form_schemas(id),
  schema_version INTEGER NOT NULL,
  filter_criteria JSONB NOT NULL,
  location_point GEOGRAPHY(POINT, 4326),
  radius_miles INTEGER,
  auto_upgrade BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id)
);

CREATE INDEX idx_provider_filters_provider ON provider_filters(provider_id);
CREATE INDEX idx_provider_filters_location ON provider_filters USING GIST(location_point);

-- ============================================
-- LEADS
-- ============================================

-- EPIC 02: Lead Intake & Confirmation
-- Lead status enum includes confirmation and approval states
CREATE TYPE lead_status AS ENUM (
  'pending_confirmation',  -- EPIC 02: Awaiting email confirmation
  'pending_approval',      -- EPIC 02: Confirmed, awaiting admin review
  'pending',               -- Legacy/fallback (maps to pending_approval)
  'approved',              -- EPIC 03: Admin approved, ready for distribution
  'rejected',              -- EPIC 03: Admin rejected
  'assigned',              -- EPIC 06: Assigned to providers
  'expired',               -- Lead expired before assignment
  'refunded'               -- EPIC 09: Refunded due to bad lead
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE RESTRICT,
  schema_id UUID REFERENCES niche_form_schemas(id),
  schema_version INTEGER NOT NULL,
  status lead_status NOT NULL DEFAULT 'pending_confirmation',
  
  -- Contact information
  submitter_name VARCHAR(255) NOT NULL,
  submitter_email VARCHAR(255) NOT NULL,
  submitter_phone VARCHAR(20),
  
  -- Lead data
  niche_data JSONB NOT NULL,
  
  -- Location data (for location-based niches)
  location_point GEOGRAPHY(POINT, 4326),
  location_address TEXT,
  location_city VARCHAR(100),
  location_state VARCHAR(50),
  location_zip VARCHAR(20),
  
  -- EPIC 02: Email confirmation fields
  confirmation_token_hash VARCHAR(255),
  confirmation_expires_at TIMESTAMPTZ,
  confirmation_token_used BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  resend_count INTEGER DEFAULT 0,
  last_resend_at TIMESTAMPTZ,
  
  -- EPIC 02: Attribution tracking
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  referrer_url TEXT,
  partner_id UUID,  -- Future partner program
  
  -- EPIC 03: Admin approval/rejection fields
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  admin_notes TEXT,
  
  -- EPIC 06: Distribution tracking
  distributed_at TIMESTAMPTZ,
  distribution_attempts INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  assigned_count INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_leads_niche ON leads(niche_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_leads_location ON leads USING GIST(location_point);
CREATE INDEX idx_leads_submitter_email ON leads(submitter_email);
CREATE INDEX idx_leads_confirmation_token_hash 
  ON leads(confirmation_token_hash) 
  WHERE confirmation_token_hash IS NOT NULL;

-- EPIC 03: Admin query indexes
CREATE INDEX idx_leads_status_created ON leads(status, created_at);
CREATE INDEX idx_leads_approved_at ON leads(approved_at) WHERE approved_at IS NOT NULL;
CREATE INDEX idx_leads_rejected_at ON leads(rejected_at) WHERE rejected_at IS NOT NULL;

-- EPIC 11: Composite indexes for report queries
CREATE INDEX IF NOT EXISTS idx_leads_niche_submitted ON leads(niche_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_niche_confirmed ON leads(niche_id, confirmed_at DESC) WHERE confirmed_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_niche_approved_at ON leads(niche_id, approved_at DESC) WHERE approved_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_niche_distributed ON leads(niche_id, distributed_at DESC) WHERE distributed_at IS NOT NULL AND deleted_at IS NULL;

-- ============================================
-- LEAD ASSIGNMENTS
-- ============================================

CREATE TYPE assignment_status AS ENUM ('active', 'accepted', 'rejected', 'refunded');

CREATE TABLE lead_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES competition_level_subscriptions(id) ON DELETE RESTRICT,
  -- EPIC 06: Competition level for distribution tracking
  competition_level_id UUID NOT NULL REFERENCES competition_levels(id) ON DELETE RESTRICT,
  status assignment_status NOT NULL DEFAULT 'active',
  price_cents INTEGER NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- EPIC 08: Provider lead management fields
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- EPIC 09: Bad lead & refunds fields
  bad_lead_reported_at TIMESTAMPTZ,
  bad_lead_reason_category VARCHAR(50) CHECK (bad_lead_reason_category IN ('spam','duplicate','invalid_contact','out_of_scope','other')),
  bad_lead_reason_notes TEXT,
  bad_lead_status VARCHAR(20) CHECK (bad_lead_status IN ('pending','approved','rejected')),
  refunded_at TIMESTAMPTZ,
  refund_amount DECIMAL(10,2),
  refund_reason TEXT,
  UNIQUE(lead_id, provider_id)
);

CREATE INDEX idx_lead_assignments_lead ON lead_assignments(lead_id);
CREATE INDEX idx_lead_assignments_provider ON lead_assignments(provider_id);
CREATE INDEX idx_lead_assignments_assigned_at ON lead_assignments(assigned_at DESC);

-- EPIC 09: Bad lead indexes
CREATE INDEX idx_lead_assignments_bad_lead_status
  ON lead_assignments(bad_lead_status, bad_lead_reported_at DESC)
  WHERE bad_lead_status IS NOT NULL;

CREATE INDEX idx_lead_assignments_bad_lead_provider
  ON lead_assignments(provider_id, bad_lead_status, bad_lead_reported_at DESC)
  WHERE bad_lead_status IS NOT NULL;

CREATE INDEX idx_lead_assignments_provider_bad_leads
  ON lead_assignments(provider_id, bad_lead_reported_at DESC)
  WHERE bad_lead_reported_at IS NOT NULL;

-- EPIC 08: Provider inbox performance indexes
CREATE INDEX idx_lead_assignments_provider_assigned
  ON lead_assignments(provider_id, assigned_at DESC);

CREATE INDEX idx_lead_assignments_provider_status
  ON lead_assignments(provider_id, status);

CREATE INDEX idx_lead_assignments_provider_niche
  ON lead_assignments(provider_id, competition_level_id, assigned_at DESC);

-- EPIC 08: Search indexes for leads
CREATE INDEX idx_leads_contact_email_lower
  ON leads(LOWER(contact_email));

CREATE INDEX idx_leads_contact_phone
  ON leads(contact_phone);

-- ============================================
-- PAYMENTS (EPIC 07)
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  provider_name VARCHAR(50) NOT NULL CHECK (provider_name IN ('stripe', 'paypal')),
  external_payment_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payments_provider_external UNIQUE(provider_name, external_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_provider_status 
  ON payments(provider_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_external_id 
  ON payments(external_payment_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider_created 
  ON payments(provider_id, created_at DESC);

-- ============================================
-- PROVIDER LEDGER (Financial Transactions)
-- ============================================

-- EPIC 07: Updated transaction types
CREATE TYPE transaction_type AS ENUM ('deposit', 'lead_purchase', 'refund', 'manual_credit', 'manual_debit');

CREATE TABLE provider_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  -- EPIC 07: subscription_id nullable, add related entities
  subscription_id UUID REFERENCES competition_level_subscriptions(id),
  transaction_type transaction_type NOT NULL,
  -- EPIC 07: Use DECIMAL instead of cents
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  -- EPIC 07: Related entities
  related_lead_id UUID REFERENCES leads(id),
  related_subscription_id UUID REFERENCES competition_level_subscriptions(id),
  related_payment_id UUID REFERENCES payments(id),
  -- EPIC 07: Actor tracking
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(20) CHECK (actor_role IN ('system', 'admin', 'provider')),
  -- EPIC 07: Memo for manual adjustments
  memo TEXT,
  -- Legacy fields (keep for backward compatibility)
  lead_assignment_id UUID REFERENCES lead_assignments(id),
  stripe_payment_intent_id VARCHAR(255),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_ledger_provider ON provider_ledger(provider_id);
CREATE INDEX idx_provider_ledger_subscription ON provider_ledger(subscription_id);
CREATE INDEX idx_provider_ledger_created ON provider_ledger(created_at DESC);
-- EPIC 07: Additional indexes for performance
CREATE INDEX idx_provider_ledger_provider_created ON provider_ledger(provider_id, created_at DESC);
CREATE INDEX idx_provider_ledger_payment ON provider_ledger(related_payment_id) WHERE related_payment_id IS NOT NULL;

-- EPIC 11: Additional indexes for revenue report queries
CREATE INDEX IF NOT EXISTS idx_provider_ledger_provider_created_type ON provider_ledger(provider_id, created_at DESC, entry_type);
CREATE INDEX IF NOT EXISTS idx_provider_ledger_lead_entry_type ON provider_ledger(related_lead_id, entry_type) WHERE related_lead_id IS NOT NULL;

-- ============================================
-- LEAD FEEDBACK
-- ============================================

CREATE TABLE lead_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  provider_responses JSONB,
  comments TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id)
);

CREATE INDEX idx_lead_feedback_lead ON lead_feedback(lead_id);
CREATE INDEX idx_lead_feedback_submitted ON lead_feedback(submitted_at DESC);

-- ============================================
-- PROVIDER QUALITY METRICS
-- ============================================

CREATE TYPE quality_status AS ENUM ('good', 'warning', 'probation', 'suspended');

CREATE TABLE provider_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  total_leads_received INTEGER NOT NULL DEFAULT 0,
  total_feedback_received INTEGER NOT NULL DEFAULT 0,
  response_rate DECIMAL(5,2),
  avg_rating DECIMAL(3,2),
  quality_score INTEGER,
  status quality_status NOT NULL DEFAULT 'good',
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id)
);

CREATE INDEX idx_provider_quality_provider ON provider_quality_metrics(provider_id);
CREATE INDEX idx_provider_quality_status ON provider_quality_metrics(status);

-- EPIC 11: Report Export Jobs
CREATE TABLE IF NOT EXISTS report_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('admin','provider')),
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('admin','provider')),
  type VARCHAR(50) NOT NULL,
  filters JSONB,
  format VARCHAR(10) NOT NULL DEFAULT 'csv',
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending','processing','completed','failed')),
  row_count INTEGER,
  artifact_path TEXT,
  download_expires_at TIMESTAMPTZ,
  file_expires_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_exports_requested_by_created
  ON report_export_jobs(requested_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_exports_status_created
  ON report_export_jobs(status, created_at DESC);

-- EPIC 12: Dead Letter Queue
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name VARCHAR(100) NOT NULL,
  job_id VARCHAR(100),
  payload JSONB,
  error_message TEXT,
  stack_trace TEXT,
  attempts INT,
  failed_at TIMESTAMPTZ NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlq_queue_failed_at
  ON dead_letter_queue(queue_name, failed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dlq_resolved
  ON dead_letter_queue(resolved, failed_at DESC);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_niches_updated_at BEFORE UPDATE ON niches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_subscriptions_updated_at BEFORE UPDATE ON provider_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_filters_updated_at BEFORE UPDATE ON provider_filters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competition_levels_updated_at BEFORE UPDATE ON competition_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competition_level_subscriptions_updated_at BEFORE UPDATE ON competition_level_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_quality_metrics_updated_at BEFORE UPDATE ON provider_quality_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SYSTEM USER SEED (EPIC 01)
-- ============================================
-- The system user is used for background jobs, webhooks, and automated actions.
-- This user should be created during initial setup.

INSERT INTO users (
  id,
  email,
  password_hash,
  role,
  status,
  email_verified,
  first_name,
  last_name
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system@findmeahotlead.internal',
  '$2a$12$SYSTEM_USER_NO_LOGIN_ALLOWED',  -- Invalid hash, cannot login
  'system',
  'active',
  true,
  'System',
  'Actor'
) ON CONFLICT (id) DO NOTHING;
