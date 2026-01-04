import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import postgres from 'postgres'
import { seedEmailTemplates } from './seeds/email-templates'

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
