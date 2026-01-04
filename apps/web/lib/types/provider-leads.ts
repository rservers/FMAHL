/**
 * TypeScript types for EPIC 08 - Provider Lead Management
 * 
 * @see .cursor/docs/Delivery/Epic_08_Provider_Lead_Management.md
 */

export type AssignmentStatus = 'active' | 'accepted' | 'rejected' | 'refunded'

export interface ProviderLeadAssignment {
  assignment_id: string
  lead_id: string
  niche_id: string
  niche_name: string
  status: AssignmentStatus
  price_charged: number
  assigned_at: string
  viewed_at: string | null
  accepted_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  contact_email: string
  contact_phone: string | null
  contact_name: string | null
}

export interface LeadDetailView extends ProviderLeadAssignment {
  form_data: Record<string, unknown>
  billing_context: {
    price_charged: number
    charged_at: string
    competition_level: string
    subscription_id: string
  }
  attribution?: {
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    referrer_url: string | null
  }
}

export interface ProviderInboxFilters {
  status?: AssignmentStatus
  niche_id?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  limit?: number
}

export interface ProviderInboxResponse {
  page: number
  limit: number
  total_count: number
  total_pages: number
  items: ProviderLeadAssignment[]
}

export interface NotificationPreferences {
  notify_on_new_lead: boolean
  notify_on_lead_status_change: boolean
  notify_on_bad_lead_decision: boolean
}

export interface LeadExportRequest {
  filters?: {
    status?: AssignmentStatus
    date_from?: string
    date_to?: string
    niche_id?: string
  }
}

export interface LeadExportResponse {
  ok: boolean
  export_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  estimated_rows: number
  message: string
}

