/**
 * GET /metrics
 * 
 * Prometheus metrics endpoint
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { NextResponse } from 'next/server'
import { register } from '@/lib/services/metrics'

export async function GET() {
  try {
    const metrics = await register.metrics()
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
      },
    })
  } catch (error) {
    console.error('Error generating metrics:', error)
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    )
  }
}

