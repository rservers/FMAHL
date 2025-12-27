import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'

config({ path: resolve(__dirname, '../../.env.local') })

import { sql } from './client'

async function migrate() {
  console.log('🚀 Running database migrations...\n')

  try {
    const schemaSQL = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8')
    
    await sql.unsafe(schemaSQL)
    
    console.log('✅ Database schema created successfully!')
    console.log('\n📊 Tables created:')
    console.log('  - users')
    console.log('  - niches')
    console.log('  - niche_form_schemas')
    console.log('  - providers')
    console.log('  - provider_subscriptions')
    console.log('  - provider_filters')
    console.log('  - leads')
    console.log('  - lead_assignments')
    console.log('  - provider_ledger')
    console.log('  - lead_feedback')
    console.log('  - provider_quality_metrics')
    console.log('  - audit_log')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

migrate()
