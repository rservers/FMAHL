/**
 * Billing Types for EPIC 07 - Billing & Payments
 * 
 * Defines TypeScript types for billing, payments, and ledger entries.
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

/**
 * Ledger entry types
 */
export type LedgerEntryType =
  | 'deposit'
  | 'lead_purchase'
  | 'refund'
  | 'manual_credit'
  | 'manual_debit'

/**
 * Payment provider names
 */
export type PaymentProvider = 'stripe' | 'paypal'

/**
 * Payment status
 */
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

/**
 * Actor role for ledger entries
 */
export type LedgerActorRole = 'system' | 'admin' | 'provider'

/**
 * Ledger entry interface
 */
export interface LedgerEntry {
  id: string
  provider_id: string
  entry_type: LedgerEntryType
  amount: number // DECIMAL(10,2) as number
  balance_after: number // DECIMAL(10,2) as number
  related_lead_id?: string | null
  related_subscription_id?: string | null
  related_payment_id?: string | null
  actor_id?: string | null
  actor_role?: LedgerActorRole | null
  memo?: string | null
  created_at: string // ISO timestamp
}

/**
 * Payment record interface
 */
export interface Payment {
  id: string
  provider_id: string
  provider_name: PaymentProvider
  external_payment_id: string
  amount: number
  currency: string
  status: PaymentStatus
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
}

/**
 * Provider balance information
 */
export interface ProviderBalance {
  provider_id: string
  balance: number
  low_balance_threshold?: number | null
  low_balance_alert_sent: boolean
  auto_topup_enabled: boolean
  auto_topup_threshold?: number | null
  auto_topup_amount?: number | null
}

/**
 * Deposit initiation request
 */
export interface DepositRequest {
  provider_name: PaymentProvider
  amount: number
  currency?: string
}

/**
 * Deposit initiation response
 */
export interface DepositResponse {
  payment_id: string
  provider_name: PaymentProvider
  checkout_url: string
  status: PaymentStatus
}

/**
 * Refund request
 */
export interface RefundRequest {
  refund_reason: string
  memo?: string
}

/**
 * Balance adjustment request
 */
export interface BalanceAdjustRequest {
  entry_type: 'manual_credit' | 'manual_debit'
  amount: number
  memo: string
}

/**
 * Billing history query parameters
 */
export interface BillingHistoryQuery {
  page?: number
  limit?: number
  entry_type?: LedgerEntryType
  date_from?: string
  date_to?: string
}

/**
 * Billing history response
 */
export interface BillingHistoryResponse {
  entries: LedgerEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

