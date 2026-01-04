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
