import { config } from 'dotenv'
import { resolve } from 'path'
import { ConnectionOptions, Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { emailWorker } from './processors/email'
import { createDistributionWorker } from './processors/distribution'

// Load .env.local from project root (2 levels up from this file)
config({ path: resolve(__dirname, '../../../.env.local') })

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Parse Redis URL
const redisUrl = new URL(REDIS_URL)
const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
  password: redisUrl.password || undefined,
}

// Create Redis connection
const redis = new IORedis(connection)

console.log('🚀 Worker starting...')
console.log(`📡 Redis connection: ${redisUrl.hostname}:${redisUrl.port}`)

// Distribution worker (EPIC 06)
const distributionWorker = createDistributionWorker(connection)

distributionWorker.on('completed', (job) => {
  console.log(`✅ Distribution job ${job.id} completed`)
})

distributionWorker.on('failed', (job, err) => {
  console.error(`❌ Distribution job ${job?.id} failed:`, err)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down worker...')
  await distributionWorker.close()
  await emailWorker.close()
  await redis.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down worker...')
  await distributionWorker.close()
  await emailWorker.close()
  await redis.quit()
  process.exit(0)
})

console.log('✅ Worker ready and listening for jobs')

