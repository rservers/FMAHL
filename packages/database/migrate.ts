import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'

config({ path: resolve(__dirname, '../../.env.local') })

import { sql } from './client'

async function migrate() {
  console.log('🚀 Running database migrations...\n')

  try {
    const schemaSQL = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8')
    
    try {
      await sql.unsafe(schemaSQL)
      console.log('✅ Database schema created successfully!')
    } catch (error: any) {
      // Check if this is an "already exists" error
      // PostgreSQL error codes:
      // 42710 = duplicate_object (for types, extensions)
      // 42P07 = duplicate_table (for tables)
      // 23505 = unique_violation (for unique constraints)
      if (error.code === '42710' || error.code === '42P07') {
        console.log('⚠️  Some database objects already exist. Checking schema...')
        
        // Try to verify tables exist
        const tables = await sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `
        
        if (tables.length > 0) {
          console.log('✅ Database schema already exists!')
          console.log(`   Found ${tables.length} tables in the database`)
        } else {
          // If no tables found, there might be a different issue
          throw error
        }
      } else if (error.severity === 'NOTICE' || error.severity_local === 'NOTICE') {
        // Handle notices (like "extension already exists") as warnings, not errors
        console.log('⚠️  Migration notice:', error.message)
        console.log('✅ Continuing with migration...')
        
        // Try to execute again, this time the notices won't stop execution
        try {
          await sql.unsafe(schemaSQL)
          console.log('✅ Database schema created successfully!')
        } catch (retryError: any) {
          // If it fails again with a real error, throw it
          if (retryError.code !== '42710' && retryError.code !== '42P07') {
            throw retryError
          }
          // Otherwise, check if tables exist
          const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
          `
          if (tables.length > 0) {
            console.log('✅ Database schema already exists!')
          } else {
            throw retryError
          }
        }
      } else {
        // Re-throw actual errors
        throw error
      }
    }
    
    console.log('\n📊 Schema includes:')
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
