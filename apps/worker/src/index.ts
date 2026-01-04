import { config } from 'dotenv'
import { resolve } from 'path'
import { ConnectionOptions, Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

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

// Example queue setup - you can add your actual job queues here
const exampleQueue = new Queue('example', { connection })

// Example worker - you can add your actual job processors here
const exampleWorker = new Worker(
  'example',
  async (job) => {
    console.log(`Processing job ${job.id} with data:`, job.data)
    // Add your job processing logic here
    return { success: true }
  },
  { connection }
)

exampleWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`)
})

exampleWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down worker...')
  await exampleWorker.close()
  await redis.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down worker...')
  await exampleWorker.close()
  await redis.quit()
  process.exit(0)
})

console.log('✅ Worker ready and listening for jobs')

