import { testConnection, sql } from './client'

async function main() {
  console.log('🔍 Testing database connection...')
  
  const connected = await testConnection()
  
  if (connected) {
    console.log('✅ All good! Database is ready.')
  } else {
    console.log('❌ Connection failed. Check your DATABASE_URL')
  }
  
  await sql.end()
  process.exit(0)
}

main()
