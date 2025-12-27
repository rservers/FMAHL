-- Enable PostGIS extension for location data
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'provider', 'end_user');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'end_user',
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

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

CREATE TYPE lead_status AS ENUM ('pending', 'assigned', 'expired', 'refunded');

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE RESTRICT,
  schema_id UUID REFERENCES niche_form_schemas(id),
  schema_version INTEGER NOT NULL,
  status lead_status NOT NULL DEFAULT 'pending',
  submitter_name VARCHAR(255) NOT NULL,
  submitter_email VARCHAR(255) NOT NULL,
  submitter_phone VARCHAR(20),
  niche_data JSONB NOT NULL,
  location_point GEOGRAPHY(POINT, 4326),
  location_address TEXT,
  location_city VARCHAR(100),
  location_state VARCHAR(50),
  location_zip VARCHAR(20),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  assigned_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_leads_niche ON leads(niche_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_leads_location ON leads USING GIST(location_point);

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
-- AUDIT LOG
-- ============================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id),
  changes JSONB,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

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
