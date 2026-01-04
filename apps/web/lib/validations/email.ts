import { z } from 'zod'

export const emailTemplateCreateSchema = z.object({
  template_key: z.string().min(1).max(100),
  subject: z.string().min(1),
  body_html: z.string().min(1),
  body_text: z.string().optional(),
  variables: z.array(z.string().min(1)).default([]),
  is_active: z.boolean().optional(),
})

export const emailTemplateUpdateSchema = z.object({
  subject: z.string().min(1).optional(),
  body_html: z.string().min(1).optional(),
  body_text: z.string().optional(),
  variables: z.array(z.string().min(1)).optional(),
  is_active: z.boolean().optional(),
})

export const emailTemplatePreviewSchema = z.object({
  variables: z.record(z.string(), z.any()),
})

export const emailTemplatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  template_key: z.string().optional(),
  is_active: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
})

export const emailEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  email_type: z.string().optional(),
  recipient_email: z.string().optional(),
  event_type: z
    .enum(['queued', 'sent', 'delivered', 'opened', 'bounced', 'complained', 'failed'])
    .optional(),
})

