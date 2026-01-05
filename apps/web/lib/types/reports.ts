/**
 * TypeScript types for EPIC 11 - Reporting & Analytics
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

export interface AdminKPIDashboard {
  period: { from: string; to: string }
  kpis: {
    total_leads_submitted: number
    total_leads_confirmed: number
    total_leads_approved: number
    total_leads_rejected: number
    total_leads_distributed: number
    confirmation_rate: number
    approval_rate: number
    distribution_rate: number
    avg_time_to_confirmation_minutes: number
    avg_time_to_approval_hours: number
    avg_time_to_distribution_minutes: number
    total_revenue: number
    total_refunds: number
    net_revenue: number
    bad_lead_report_rate: number
    bad_lead_approval_rate: number
    top_rejection_reasons: Array<{ reason: string; count: number }>
  }
}

export interface FunnelSeries {
  period: { from: string; to: string }
  bucket: 'day' | 'hour'
  niche_id: string | null
  series: Array<{
    date: string
    submitted: number
    confirmed: number
    approved: number
    distributed: number
  }>
}

export interface RevenueSummary {
  period: { from: string; to: string }
  total_deposits: number
  total_lead_purchases: number
  total_refunds: number
  net_revenue: number
  payment_status_breakdown: Array<{ status: string; count: number; total_amount: number }>
  provider_topups_count: number
}

export interface StarvationReport {
  period: { from: string; to: string }
  threshold_days: number
  starved_subscriptions: Array<{
    subscription_id: string
    provider_id: string
    provider_name: string
    niche_id: string
    niche_name: string
    competition_level_id: string
    competition_level_name: string
    last_received_at: string | null
    days_since_last_lead: number | null
  }>
}

export interface FlaggedProvider {
  provider_id: string
  provider_name: string
  total_assignments: number
  total_bad_lead_reports: number
  total_bad_lead_approved: number
  approval_rate: number
  refund_rate: number
  flagged: boolean
  flagged_reasons: string[]
}

export interface ProviderKPIDashboard {
  period: { from: string; to: string }
  group_by: 'niche' | 'none'
  kpis: Array<{
    niche_id?: string
    niche_name?: string
    assignments_received: number
    acceptance_rate: number
    rejection_rate: number
    avg_time_to_view_minutes: number
    avg_time_to_accept_minutes: number
    bad_lead_reports_count: number
    bad_lead_approved_count: number
    refunds_amount: number
    net_spend: number
  }>
}

export type ExportScope = 'admin' | 'provider'
export type ExportType = 'funnel' | 'kpis' | 'revenue' | 'fairness' | 'bad_leads' | 'assigned_leads' | 'distribution_metrics'

export interface ExportJobRequest {
  scope: ExportScope
  type: ExportType
  filters: {
    date_from?: string
    date_to?: string
    niche_id?: string
    provider_id?: string
    competition_level_id?: string
    [key: string]: any
  }
  format?: 'csv' | 'xlsx'
}

export interface ExportJobStatus {
  job_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
  row_count: number | null
  download_url: string | null
  expires_at: string | null
  error: string | null
}

