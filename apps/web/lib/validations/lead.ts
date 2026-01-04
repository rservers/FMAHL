/**
 * Zod validation schemas for lead submission (EPIC 02)
 * 
 * @see .cursor/docs/Delivery/Epic_02_Lead_Intake_Confirmation.md
 */

import { z } from 'zod'

/**
 * Email validation
 */
const emailSchema = z.string().email('Invalid email address').toLowerCase()

/**
 * Phone validation (E.164 or basic format)
 */
const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$|^[\d\s\-\(\)]+$/, 'Invalid phone number format')
  .optional()

/**
 * Attribution schema
 */
export const attributionSchema = z
  .object({
    utm_source: z.string().max(255).optional(),
    utm_medium: z.string().max(255).optional(),
    utm_campaign: z.string().max(255).optional(),
    referrer_url: z.string().url().optional().or(z.literal('')),
    partner_id: z.string().uuid().optional(),
  })
  .optional()

/**
 * Lead submission schema
 */
export const leadSubmissionSchema = z.object({
  niche_id: z.string().uuid('Invalid niche ID'),
  contact_email: emailSchema,
  contact_name: z.string().min(1).max(255),
  contact_phone: phoneSchema,
  form_data: z.record(z.string(), z.any()), // Will be validated against niche.form_schema
  attribution: attributionSchema,
})

/**
 * Lead confirmation schema
 */
export const leadConfirmationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

/**
 * Resend confirmation schema
 */
export const resendConfirmationSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID'),
})

