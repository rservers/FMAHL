/**
 * Billing Validation Schemas for EPIC 07
 * 
 * Zod schemas for validating billing requests and queries.
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { z } from 'zod'
import { MIN_DEPOSIT_USD, MEMO_MIN_LENGTH, MEMO_MAX_LENGTH, DEFAULT_BILLING_PAGE_SIZE, MAX_BILLING_PAGE_SIZE } from '../constants/billing'

/**
 * Payment provider schema
 */
export const paymentProviderSchema = z.enum(['stripe', 'paypal'])

/**
 * Payment status schema
 */
export const paymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'refunded'])

/**
 * Ledger entry type schema
 */
export const ledgerEntryTypeSchema = z.enum([
  'deposit',
  'lead_purchase',
  'refund',
  'manual_credit',
  'manual_debit',
])

/**
 * Create deposit request schema
 */
export const createDepositSchema = z.object({
  provider_name: paymentProviderSchema,
  amount: z.number().positive().min(MIN_DEPOSIT_USD, {
    message: `Minimum deposit is ${MIN_DEPOSIT_USD.toFixed(2)} USD`,
  }),
  currency: z.string().length(3).default('USD'),
})

/**
 * Refund assignment schema
 */
export const refundAssignmentSchema = z.object({
  refund_reason: z.string().min(1, 'Refund reason is required').max(500),
  memo: z.string().max(500).optional(),
})

/**
 * Balance adjustment schema
 */
export const balanceAdjustSchema = z.object({
  entry_type: z.enum(['manual_credit', 'manual_debit']),
  amount: z.number().positive('Amount must be positive'),
  memo: z
    .string()
    .min(MEMO_MIN_LENGTH, `Memo must be at least ${MEMO_MIN_LENGTH} characters`)
    .max(MEMO_MAX_LENGTH, `Memo must be at most ${MEMO_MAX_LENGTH} characters`),
})

/**
 * Billing history query schema
 */
export const billingHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_BILLING_PAGE_SIZE).default(DEFAULT_BILLING_PAGE_SIZE),
  entry_type: ledgerEntryTypeSchema.optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
})

/**
 * Admin payments query schema
 */
export const adminPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_BILLING_PAGE_SIZE).default(DEFAULT_BILLING_PAGE_SIZE),
  status: paymentStatusSchema.optional(),
  provider_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
})

/**
 * Admin providers query schema
 */
export const adminProvidersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_BILLING_PAGE_SIZE).default(DEFAULT_BILLING_PAGE_SIZE),
  search: z.string().optional(),
  status: z.enum(['pending', 'active', 'suspended', 'inactive']).optional(),
})

