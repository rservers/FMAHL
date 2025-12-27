import { config } from 'dotenv'
import { resolve } from 'path'
import postgres from 'postgres'

// Load .env.local from project root (2 levels up from this file)
config({ path: resolve(__dirname, '../../.env.local') })

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as current_time`
    console.log('✅ Database connected:', result[0].current_time)
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

export default sql
