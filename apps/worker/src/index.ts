import { config } from 'dotenv'
import { resolve } from 'path'
import { ConnectionOptions, Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { emailWorker } from './processors/email'
import { createDistributionWorker } from './processors/distribution'
import { processReportExport } from './processors/report-export'
import { processSubscriptionReactivation } from './jobs/subscription-reactivation'
import { processBalanceReconciliation } from './jobs/balance-reconciliation'
import { processDLQCleanup } from './jobs/dlq-cleanup'
import { setupDLQCapture } from './lib/dlq'

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
setupDLQCapture(distributionWorker, 'distribution')

distributionWorker.on('completed', (job) => {
  console.log(`✅ Distribution job ${job.id} completed`)
})

distributionWorker.on('failed', (job, err) => {
  console.error(`❌ Distribution job ${job?.id} failed:`, err)
})

// Report export worker (EPIC 11)
const reportExportWorker = new Worker('report-export', processReportExport, {
  connection,
  concurrency: 2,
})
setupDLQCapture(reportExportWorker, 'report-export')

reportExportWorker.on('completed', (job) => {
  console.log(`✅ Report export job ${job.id} completed`)
})

reportExportWorker.on('failed', (job, err) => {
  console.error(`❌ Report export job ${job?.id} failed:`, err)
})

// Scheduled Jobs (EPIC 12)
const schedulerQueue = new Queue('scheduler', { connection })

// Subscription reactivation: Every 5 minutes
await schedulerQueue.add(
  'subscription-reactivation',
  {},
  {
    repeat: {
      pattern: '*/5 * * * *', // Every 5 minutes
    },
  }
)

// Balance reconciliation: Nightly at 3 AM
await schedulerQueue.add(
  'balance-reconciliation',
  {},
  {
    repeat: {
      pattern: '0 3 * * *', // 3 AM daily
    },
  }
)

// DLQ cleanup: Weekly on Sunday at midnight
await schedulerQueue.add(
  'dlq-cleanup',
  {},
  {
    repeat: {
      pattern: '0 0 * * 0', // Sunday at midnight
    },
  }
)

const schedulerWorker = new Worker('scheduler', async (job) => {
  switch (job.name) {
    case 'subscription-reactivation':
      return processSubscriptionReactivation(job)
    case 'balance-reconciliation':
      return processBalanceReconciliation(job)
    case 'dlq-cleanup':
      return processDLQCleanup(job)
    default:
      throw new Error(`Unknown scheduled job: ${job.name}`)
  }
}, {
  connection,
  concurrency: 1, // Run scheduled jobs sequentially
})

setupDLQCapture(schedulerWorker, 'scheduler')

schedulerWorker.on('completed', (job) => {
  console.log(`✅ Scheduled job ${job.name} (${job.id}) completed`)
})

schedulerWorker.on('failed', (job, err) => {
  console.error(`❌ Scheduled job ${job?.name} (${job?.id}) failed:`, err)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down worker...')
  await distributionWorker.close()
  await emailWorker.close()
  await reportExportWorker.close()
  await schedulerWorker.close()
  await schedulerQueue.close()
  await redis.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down worker...')
  await distributionWorker.close()
  await emailWorker.close()
  await reportExportWorker.close()
  await schedulerWorker.close()
  await schedulerQueue.close()
  await redis.quit()
  process.exit(0)
})

console.log('✅ Worker ready and listening for jobs')

