/**
 * Billing Constants for EPIC 07
 * 
 * Configuration constants for billing operations.
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

/**
 * Minimum deposit amount in USD
 */
export const MIN_DEPOSIT_USD = parseFloat(process.env.MIN_DEPOSIT_USD || '10.00')

/**
 * Memo validation constraints
 */
export const MEMO_MIN_LENGTH = 10
export const MEMO_MAX_LENGTH = 500

/**
 * Default pagination for billing history
 */
export const DEFAULT_BILLING_PAGE_SIZE = 50
export const MAX_BILLING_PAGE_SIZE = 100

/**
 * Balance reconciliation tolerance (for nightly job)
 */
export const BALANCE_RECONCILIATION_TOLERANCE = 0.01

/**
 * Currency codes
 */
export const SUPPORTED_CURRENCIES = ['USD'] as const
export const DEFAULT_CURRENCY = 'USD'

