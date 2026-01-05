import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import postgres from 'postgres'
import { seedEmailTemplates } from './seeds/email-templates'
import { seedNiches } from './seeds/niches'

config({ path: resolve(__dirname, '../../.env.local') })

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Create a separate connection for migration with notice handling
const sql = postgres(DATABASE_URL, {
  max: 1,
  onnotice: () => {
    // Suppress all notices during migration - they're expected
  },
})

async function ensureEmailTables() {
  // Create email template + event tables idempotently (EPIC 10)
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_key VARCHAR(100) UNIQUE NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      body_text TEXT,
      variables JSONB NOT NULL DEFAULT '[]',
      is_active BOOLEAN DEFAULT true,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_events (
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

    CREATE INDEX IF NOT EXISTS idx_email_templates_key_active ON email_templates(template_key, is_active);
    CREATE INDEX IF NOT EXISTS idx_email_events_entity ON email_events(related_entity_type, related_entity_id);
    CREATE INDEX IF NOT EXISTS idx_email_events_created ON email_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_email_events_recipient ON email_events(recipient_email);
  `)
}

async function ensureEpic02Schema() {
  // EPIC 02: Add lead_status enum values and leads table columns idempotently
  await sql.unsafe(`
    DO $$ 
    BEGIN
      -- Add enum values if they don't exist
      IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_confirmation' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')) THEN
        ALTER TYPE lead_status ADD VALUE 'pending_confirmation';
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_approval' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')) THEN
        ALTER TYPE lead_status ADD VALUE 'pending_approval';
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'approved' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')) THEN
        ALTER TYPE lead_status ADD VALUE 'approved';
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rejected' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')) THEN
        ALTER TYPE lead_status ADD VALUE 'rejected';
      END IF;
    END $$;

    -- Add confirmation columns if they don't exist
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmation_token_hash VARCHAR(255);
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmation_token_used BOOLEAN DEFAULT false;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_resend_at TIMESTAMPTZ;

    -- Add attribution columns if they don't exist
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255);
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255);
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255);
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer_url TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS partner_id UUID;

    -- Add indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_leads_submitter_email ON leads(submitter_email);
    CREATE INDEX IF NOT EXISTS idx_leads_confirmation_token_hash 
      ON leads(confirmation_token_hash) 
      WHERE confirmation_token_hash IS NOT NULL;
  `)
}

async function ensureEpic03Schema() {
  // EPIC 03: Add admin approval/rejection fields and indexes idempotently
  await sql.unsafe(`
    -- Add admin approval/rejection columns if they don't exist
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id);
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS admin_notes TEXT;

    -- Add indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_leads_approved_at ON leads(approved_at) WHERE approved_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_leads_rejected_at ON leads(rejected_at) WHERE rejected_at IS NOT NULL;
  `)
}

async function ensureEpic04Schema() {
  // EPIC 04: Create competition_levels and competition_level_subscriptions tables idempotently
  await sql.unsafe(`
    -- Create competition_levels table if it doesn't exist
    CREATE TABLE IF NOT EXISTS competition_levels (
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

    -- Create competition_level_subscriptions table if it doesn't exist
    CREATE TABLE IF NOT EXISTS competition_level_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      competition_level_id UUID NOT NULL REFERENCES competition_levels(id) ON DELETE RESTRICT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      deactivation_reason VARCHAR(255),
      subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    -- Create unique indexes (only for non-deleted)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_levels_name_unique 
      ON competition_levels(niche_id, name) 
      WHERE deleted_at IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_levels_order_unique 
      ON competition_levels(niche_id, order_position) 
      WHERE deleted_at IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_cls_provider_level_unique 
      ON competition_level_subscriptions(provider_id, competition_level_id) 
      WHERE deleted_at IS NULL;

    -- Create regular indexes
    CREATE INDEX IF NOT EXISTS idx_competition_levels_niche ON competition_levels(niche_id);
    CREATE INDEX IF NOT EXISTS idx_competition_levels_active ON competition_levels(niche_id, is_active) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_competition_levels_order ON competition_levels(niche_id, order_position) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_cls_provider ON competition_level_subscriptions(provider_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_cls_level ON competition_level_subscriptions(competition_level_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_cls_active ON competition_level_subscriptions(competition_level_id, is_active) WHERE deleted_at IS NULL;
  `)
}

async function ensureEpic05Schema() {
  // EPIC 05: Add filter columns and create subscription_filter_logs table
  await sql.unsafe(`
    -- Add filter columns to competition_level_subscriptions if they don't exist
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'competition_level_subscriptions' AND column_name = 'filter_rules') THEN
        ALTER TABLE competition_level_subscriptions ADD COLUMN filter_rules JSONB;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'competition_level_subscriptions' AND column_name = 'filter_updated_at') THEN
        ALTER TABLE competition_level_subscriptions ADD COLUMN filter_updated_at TIMESTAMPTZ;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'competition_level_subscriptions' AND column_name = 'filter_is_valid') THEN
        ALTER TABLE competition_level_subscriptions ADD COLUMN filter_is_valid BOOLEAN NOT NULL DEFAULT true;
      END IF;
    END $$;

    -- Create subscription_filter_logs table if it doesn't exist
    CREATE TABLE IF NOT EXISTS subscription_filter_logs (
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

    -- Create indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_subscription_filter_logs_subscription_created
      ON subscription_filter_logs(subscription_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_subscription_filter_logs_actor
      ON subscription_filter_logs(actor_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_subscription_filter_logs_memo_fts
      ON subscription_filter_logs USING GIN (to_tsvector('english', admin_only_memo))
      WHERE admin_only_memo IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_cls_filter_updated 
      ON competition_level_subscriptions(filter_updated_at DESC) 
      WHERE filter_rules IS NOT NULL AND deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_cls_filter_invalid 
      ON competition_level_subscriptions(filter_is_valid) 
      WHERE filter_is_valid = false AND deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_cls_filter_rules_gin 
      ON competition_level_subscriptions USING GIN (filter_rules) 
      WHERE filter_rules IS NOT NULL;
  `)
}

async function ensureEpic06Schema() {
  // EPIC 06: Add distribution tracking fields idempotently
  await sql.unsafe(`
    -- Add next_start_level_order_position to niches if it doesn't exist
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'niches' AND column_name = 'next_start_level_order_position') THEN
        ALTER TABLE niches ADD COLUMN next_start_level_order_position INT NOT NULL DEFAULT 1;
      END IF;
    END $$;

    -- Add distribution tracking columns to leads if they don't exist
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'leads' AND column_name = 'distributed_at') THEN
        ALTER TABLE leads ADD COLUMN distributed_at TIMESTAMPTZ;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'leads' AND column_name = 'distribution_attempts') THEN
        ALTER TABLE leads ADD COLUMN distribution_attempts INT NOT NULL DEFAULT 0;
      END IF;
    END $$;

    -- Add index for distribution status queries
    CREATE INDEX IF NOT EXISTS idx_leads_distributed_at 
      ON leads(distributed_at) 
      WHERE distributed_at IS NOT NULL;

    -- Add competition_level_id to lead_assignments if it doesn't exist
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lead_assignments' AND column_name = 'competition_level_id') THEN
        ALTER TABLE lead_assignments ADD COLUMN competition_level_id UUID REFERENCES competition_levels(id) ON DELETE RESTRICT;
        
        -- Update existing rows by joining with competition_level_subscriptions
        UPDATE lead_assignments la
        SET competition_level_id = cls.competition_level_id
        FROM competition_level_subscriptions cls
        WHERE la.subscription_id = cls.id
          AND la.competition_level_id IS NULL;
        
        -- Make it NOT NULL after populating
        ALTER TABLE lead_assignments ALTER COLUMN competition_level_id SET NOT NULL;
      END IF;
    END $$;

    -- Add index for competition level queries
    CREATE INDEX IF NOT EXISTS idx_lead_assignments_competition_level 
      ON lead_assignments(competition_level_id);
  `)
}

async function ensureEpic11Schema() {
  // EPIC 11: Add report export jobs table
  await sql.unsafe(`
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
  `)
}

async function ensureEpic11Schema() {
  // EPIC 11: Add report export jobs table
  await sql.unsafe(`
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
  `)
}

async function ensureEpic09Schema() {
  // EPIC 09: Add bad lead & refund fields and indexes
  await sql.unsafe(`
    -- Add bad lead fields to lead_assignments
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lead_assignments' AND column_name = 'bad_lead_reported_at') THEN
        ALTER TABLE lead_assignments ADD COLUMN bad_lead_reported_at TIMESTAMPTZ;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lead_assignments' AND column_name = 'bad_lead_reason_category') THEN
        ALTER TABLE lead_assignments ADD COLUMN bad_lead_reason_category VARCHAR(50)
          CHECK (bad_lead_reason_category IN ('spam','duplicate','invalid_contact','out_of_scope','other'));
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lead_assignments' AND column_name = 'bad_lead_reason_notes') THEN
        ALTER TABLE lead_assignments ADD COLUMN bad_lead_reason_notes TEXT;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lead_assignments' AND column_name = 'bad_lead_status') THEN
        ALTER TABLE lead_assignments ADD COLUMN bad_lead_status VARCHAR(20)
          CHECK (bad_lead_status IN ('pending','approved','rejected'));
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lead_assignments' AND column_name = 'refund_amount') THEN
        ALTER TABLE lead_assignments ADD COLUMN refund_amount DECIMAL(10,2);
      END IF;
    END $$;

    -- Add performance indexes for bad lead queries
    CREATE INDEX IF NOT EXISTS idx_lead_assignments_bad_lead_status
      ON lead_assignments(bad_lead_status, bad_lead_reported_at DESC)
      WHERE bad_lead_status IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_lead_assignments_bad_lead_provider
      ON lead_assignments(provider_id, bad_lead_status, bad_lead_reported_at DESC)
      WHERE bad_lead_status IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_bad_leads
      ON lead_assignments(provider_id, bad_lead_reported_at DESC)
      WHERE bad_lead_reported_at IS NOT NULL;
  `)
}

async function ensureEpic08Schema() {
  // EPIC 08: Add provider lead management fields and indexes
  await sql.unsafe(`
    -- Update assignment_status enum to include 'accepted' and 'rejected'
    DO $$ BEGIN
      -- Check if enum values already exist
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'accepted' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'assignment_status')
      ) THEN
        ALTER TYPE assignment_status ADD VALUE 'accepted';
      END IF;
      
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'rejected' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'assignment_status')
      ) THEN
        ALTER TYPE assignment_status ADD VALUE 'rejected';
      END IF;
    END $$;

    -- Add provider lead management fields to lead_assignments
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lead_assignments' AND column_name = 'viewed_at') THEN
        ALTER TABLE lead_assignments ADD COLUMN viewed_at TIMESTAMPTZ;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lead_assignments' AND column_name = 'accepted_at') THEN
        ALTER TABLE lead_assignments ADD COLUMN accepted_at TIMESTAMPTZ;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lead_assignments' AND column_name = 'rejected_at') THEN
        ALTER TABLE lead_assignments ADD COLUMN rejected_at TIMESTAMPTZ;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lead_assignments' AND column_name = 'rejection_reason') THEN
        ALTER TABLE lead_assignments ADD COLUMN rejection_reason TEXT;
      END IF;
    END $$;

    -- Add notification preferences to providers
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'providers' AND column_name = 'notify_on_new_lead') THEN
        ALTER TABLE providers ADD COLUMN notify_on_new_lead BOOLEAN NOT NULL DEFAULT true;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'providers' AND column_name = 'notify_on_lead_status_change') THEN
        ALTER TABLE providers ADD COLUMN notify_on_lead_status_change BOOLEAN NOT NULL DEFAULT true;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'providers' AND column_name = 'notify_on_bad_lead_decision') THEN
        ALTER TABLE providers ADD COLUMN notify_on_bad_lead_decision BOOLEAN NOT NULL DEFAULT true;
      END IF;
    END $$;

    -- Add performance indexes for provider inbox
    CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_assigned
      ON lead_assignments(provider_id, assigned_at DESC);

    CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_status
      ON lead_assignments(provider_id, status);

    CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_niche
      ON lead_assignments(provider_id, competition_level_id, assigned_at DESC);

    -- Add search indexes for leads
    CREATE INDEX IF NOT EXISTS idx_leads_contact_email_lower
      ON leads(LOWER(contact_email));

    CREATE INDEX IF NOT EXISTS idx_leads_contact_phone
      ON leads(contact_phone);
  `)
}

async function ensureEpic07Schema() {
  // EPIC 07: Add balance columns to providers, create payments table, update provider_ledger
  await sql.unsafe(`
    -- Add balance columns to providers if they don't exist
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'providers' AND column_name = 'balance') THEN
        ALTER TABLE providers ADD COLUMN balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'providers' AND column_name = 'low_balance_threshold') THEN
        ALTER TABLE providers ADD COLUMN low_balance_threshold DECIMAL(10,2);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'providers' AND column_name = 'low_balance_alert_sent') THEN
        ALTER TABLE providers ADD COLUMN low_balance_alert_sent BOOLEAN DEFAULT FALSE;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'providers' AND column_name = 'auto_topup_enabled') THEN
        ALTER TABLE providers ADD COLUMN auto_topup_enabled BOOLEAN DEFAULT FALSE;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'providers' AND column_name = 'auto_topup_threshold') THEN
        ALTER TABLE providers ADD COLUMN auto_topup_threshold DECIMAL(10,2);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'providers' AND column_name = 'auto_topup_amount') THEN
        ALTER TABLE providers ADD COLUMN auto_topup_amount DECIMAL(10,2);
      END IF;
    END $$;

    -- Create payments table if it doesn't exist
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

    -- Update provider_ledger: Add new columns if they don't exist
    DO $$ BEGIN
      -- Make subscription_id nullable (if not already)
      IF EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'provider_ledger' AND column_name = 'subscription_id' AND is_nullable = 'NO') THEN
        ALTER TABLE provider_ledger ALTER COLUMN subscription_id DROP NOT NULL;
      END IF;
      
      -- Add related_lead_id
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'provider_ledger' AND column_name = 'related_lead_id') THEN
        ALTER TABLE provider_ledger ADD COLUMN related_lead_id UUID REFERENCES leads(id);
      END IF;
      
      -- Add related_subscription_id
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'provider_ledger' AND column_name = 'related_subscription_id') THEN
        ALTER TABLE provider_ledger ADD COLUMN related_subscription_id UUID REFERENCES competition_level_subscriptions(id);
      END IF;
      
      -- Add related_payment_id
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'provider_ledger' AND column_name = 'related_payment_id') THEN
        ALTER TABLE provider_ledger ADD COLUMN related_payment_id UUID REFERENCES payments(id);
      END IF;
      
      -- Add actor_id
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'provider_ledger' AND column_name = 'actor_id') THEN
        ALTER TABLE provider_ledger ADD COLUMN actor_id UUID REFERENCES users(id);
      END IF;
      
      -- Add actor_role
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'provider_ledger' AND column_name = 'actor_role') THEN
        ALTER TABLE provider_ledger ADD COLUMN actor_role VARCHAR(20) CHECK (actor_role IN ('system', 'admin', 'provider'));
      END IF;
      
      -- Add memo
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'provider_ledger' AND column_name = 'memo') THEN
        ALTER TABLE provider_ledger ADD COLUMN memo TEXT;
      END IF;
      
      -- Update transaction_type enum if needed (add manual_credit, manual_debit)
      -- Note: PostgreSQL doesn't support ALTER TYPE ADD VALUE in transaction, so we'll handle this separately
    END $$;

    -- Add indexes for provider_ledger
    CREATE INDEX IF NOT EXISTS idx_provider_ledger_provider_created 
      ON provider_ledger(provider_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_provider_ledger_payment 
      ON provider_ledger(related_payment_id) WHERE related_payment_id IS NOT NULL;
  `)
  
  // Update transaction_type enum (must be done separately due to PostgreSQL limitation)
  try {
    await sql.unsafe(`
      DO $$ BEGIN
        -- Add manual_credit if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manual_credit' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_type')) THEN
          ALTER TYPE transaction_type ADD VALUE 'manual_credit';
        END IF;
        
        -- Add manual_debit if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manual_debit' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_type')) THEN
          ALTER TYPE transaction_type ADD VALUE 'manual_debit';
        END IF;
      END $$;
    `)
  } catch (error: any) {
    // Enum values might already exist, continue
    console.log('Note: Transaction type enum update:', error.message)
  }
}

async function migrate() {
  console.log('🚀 Running database migrations...\n')

  try {
    const schemaSQL = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8')
    
    console.log('📝 Applying schema...')
    
    // Execute the entire schema at once
    await sql.unsafe(schemaSQL)
    
    console.log('✅ Database schema applied successfully!')

    // Ensure new tables are present even if prior run existed
    await ensureEmailTables()
    
    // EPIC 02: Ensure lead confirmation schema updates
    await ensureEpic02Schema()
    
    // EPIC 03: Ensure admin approval schema updates
    await ensureEpic03Schema()
    
    // EPIC 04: Ensure competition levels schema
    await ensureEpic04Schema()
    
    // EPIC 05: Ensure filter schema
    await ensureEpic05Schema()
    
    // EPIC 07: Ensure billing schema
    await ensureEpic07Schema()
    
    // EPIC 06: Ensure distribution schema
    await ensureEpic06Schema()
    
    // Verify tables were created
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
    
    console.log(`\n📊 Found ${tables.length} tables:`)
    for (const table of tables) {
      console.log(`  - ${table.table_name}`)
    }
    
    // Seed default email templates (idempotent)
    console.log('\n🌱 Seeding default email templates...')
    await seedEmailTemplates()
    console.log('✅ Email templates seed complete!')

    // Seed default niches (idempotent)
    console.log('\n🌱 Seeding default niches...')
    await seedNiches()
    console.log('✅ Niches seed complete!')

    // Verify system user was created
    const systemUser = await sql`
      SELECT id, email, role, status FROM users WHERE role = 'system'
    `
    
    if (systemUser.length > 0) {
      console.log(`\n👤 System user:`)
      console.log(`   ID: ${systemUser[0].id}`)
      console.log(`   Email: ${systemUser[0].email}`)
    } else {
      console.log('\n⚠️  System user not found')
    }
    
  } catch (error: any) {
    // Handle duplicate object errors (when running migration twice)
    if (error.code === '42710' || error.code === '42P07') {
      console.log('⚠️  Some database objects already exist.')

      // Try to ensure new tables that may not have been created previously
      await ensureEmailTables()
      
      // EPIC 02: Ensure lead confirmation schema updates
      await ensureEpic02Schema()
      
      // EPIC 03: Ensure admin approval schema updates
      await ensureEpic03Schema()
      
      // EPIC 04: Ensure competition levels schema
      await ensureEpic04Schema()
      
      // EPIC 05: Ensure filter schema
      await ensureEpic05Schema()
      
      // EPIC 07: Ensure billing schema
      await ensureEpic07Schema()
      
      // EPIC 06: Ensure distribution schema
      await ensureEpic06Schema()
      
      // EPIC 08: Ensure provider lead management schema
      await ensureEpic08Schema()
      
      // EPIC 09: Ensure bad lead & refunds schema
      await ensureEpic09Schema()
      
      // EPIC 11: Ensure report export jobs schema
      await ensureEpic11Schema()
      
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
      
      if (tables.length > 0) {
        console.log('✅ Database schema already exists!')
        console.log(`\n📊 Found ${tables.length} tables:`)
        for (const table of tables) {
          console.log(`  - ${table.table_name}`)
        }

        // Seed email templates (idempotent)
        console.log('\n🌱 Seeding default email templates...')
        await seedEmailTemplates()
        console.log('✅ Email templates seed complete!')

        // Seed default niches (idempotent)
        console.log('\n🌱 Seeding default niches...')
        await seedNiches()
        console.log('✅ Niches seed complete!')
      } else {
        console.error('❌ Migration failed:', error.message || error)
        process.exit(1)
      }
    } else {
      console.error('❌ Migration failed:', error.message || error)
      process.exit(1)
    }
  } finally {
    await sql.end()
  }
}

migrate()
