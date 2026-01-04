/**
 * TypeScript types for EPIC 09 - Bad Lead & Refunds
 * 
 * @see .cursor/docs/Delivery/Epic_09_Bad_Lead_Refunds.md
 */

export type BadLeadReasonCategory = 'spam' | 'duplicate' | 'invalid_contact' | 'out_of_scope' | 'other'

export type BadLeadStatus = 'pending' | 'approved' | 'rejected'

export interface ReportBadLeadRequest {
  reason_category: BadLeadReasonCategory
  reason_notes?: string  // required if category='other'
}

export interface BadLeadListItem {
  assignment_id: string
  lead_id: string
  provider_id: string
  provider_name: string
  niche_id: string
  niche_name: string
  bad_lead_reported_at: string
  bad_lead_reason_category: BadLeadReasonCategory
  bad_lead_reason_notes: string | null
  bad_lead_status: BadLeadStatus
  price_charged: number
}

export interface AdminBadLeadActionRequest {
  admin_memo: string  // 10-1000 chars
}

export interface ProviderBadLeadHistoryItem {
  assignment_id: string
  lead_id: string
  niche_name: string
  bad_lead_reported_at: string
  bad_lead_reason_category: BadLeadReasonCategory
  bad_lead_reason_notes: string | null
  bad_lead_status: BadLeadStatus
  refund_amount: number | null
  refunded_at: string | null
  admin_memo: string | null
}

export interface BadLeadMetrics {
  period: { from: string; to: string }
  summary: {
    total_reports: number
    total_approved: number
    total_rejected: number
    approval_rate: number
    total_refund_amount: number
    avg_resolution_time_hours: number
  }
  by_reason: Array<{
    reason_category: string
    count: number
    approval_rate: number
  }>
  by_provider: Array<{
    provider_id: string
    provider_name: string
    total_reports: number
    approval_rate: number
    total_refund_amount: number
    flagged: boolean
  }>
}

