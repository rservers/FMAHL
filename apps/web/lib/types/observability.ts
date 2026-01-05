/**
 * TypeScript types for EPIC 12 - Observability & Ops
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

export interface QueueStatus {
  name: string
  depth: number
  active: number
  failed_last_hour: number
  dlq_size: number
}

export interface QueuesResponse {
  queues: QueueStatus[]
}

export interface DLQEntry {
  id: string
  queue_name: string
  job_id: string | null
  payload: Record<string, any> | null
  error_message: string
  stack_trace: string | null
  attempts: number
  failed_at: string
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
}

export interface DLQListResponse {
  entries: DLQEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export interface DLQDetailResponse extends DLQEntry {}

export interface RetryResponse {
  ok: boolean
  job_id: string
  message: string
}

export interface ResolveResponse {
  ok: boolean
  message: string
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  checks: {
    database?: { status: 'up' | 'down'; latency_ms?: number }
    redis?: { status: 'up' | 'down'; latency_ms?: number }
    queue?: { status: 'up' | 'down'; depth?: number }
  }
}

