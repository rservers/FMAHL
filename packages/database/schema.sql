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

-- ============================================
-- LEAD ASSIGNMENTS
-- ============================================

CREATE TYPE assignment_status AS ENUM ('active', 'refunded');

CREATE TABLE lead_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES provider_subscriptions(id) ON DELETE CASCADE,
  status assignment_status NOT NULL DEFAULT 'active',
  price_cents INTEGER NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  UNIQUE(lead_id, provider_id)
);

CREATE INDEX idx_lead_assignments_lead ON lead_assignments(lead_id);
CREATE INDEX idx_lead_assignments_provider ON lead_assignments(provider_id);
CREATE INDEX idx_lead_assignments_assigned_at ON lead_assignments(assigned_at DESC);

-- ============================================
-- PROVIDER LEDGER (Financial Transactions)
-- ============================================

CREATE TYPE transaction_type AS ENUM ('deposit', 'lead_purchase', 'refund', 'adjustment');

CREATE TABLE provider_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES provider_subscriptions(id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  lead_assignment_id UUID REFERENCES lead_assignments(id),
  stripe_payment_intent_id VARCHAR(255),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_ledger_provider ON provider_ledger(provider_id);
CREATE INDEX idx_provider_ledger_subscription ON provider_ledger(subscription_id);
CREATE INDEX idx_provider_ledger_created ON provider_ledger(created_at DESC);

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
