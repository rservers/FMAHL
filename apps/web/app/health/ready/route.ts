/**
 * GET /health/ready
 * 
 * Readiness probe - checks DB, Redis, Queue connectivity
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getRedis } from '@/lib/redis'
import { getQueue } from '@/lib/queue'
import type { HealthCheckResponse } from '@/lib/types/observability'

export async function GET() {
  const checks: HealthCheckResponse['checks'] = {}
  let allHealthy = true

  // Check database
  try {
    const start = Date.now()
    await sql`SELECT 1`
    const latency = Date.now() - start
    checks.database = { status: 'up', latency_ms: latency }
  } catch (error) {
    checks.database = { status: 'down' }
    allHealthy = false
  }

  // Check Redis
  try {
    const redis = getRedis()
    const start = Date.now()
    await redis.ping()
    const latency = Date.now() - start
    checks.redis = { status: 'up', latency_ms: latency }
  } catch (error) {
    checks.redis = { status: 'down' }
    allHealthy = false
  }

  // Check queue (BullMQ)
  try {
    const queue = getQueue('distribution') // Check any queue
    const start = Date.now()
    const jobCounts = await queue.getJobCounts()
    const latency = Date.now() - start
    checks.queue = { 
      status: 'up', 
      depth: jobCounts.waiting + jobCounts.active 
    }
  } catch (error) {
    checks.queue = { status: 'down' }
    allHealthy = false
  }

  const response: HealthCheckResponse = {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
  }

  return NextResponse.json(response, { 
    status: allHealthy ? 200 : 503 
  })
}

