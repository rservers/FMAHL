import type { TemplateDefinition } from '../types'

// Default template definitions for MVP email flows
export const defaultTemplates: Record<TemplateDefinition['key'], TemplateDefinition> = {
  email_verification: {
    key: 'email_verification',
    subject: 'Verify your email for Find Me A Hot Lead',
    html: `<p>Hi {{email}},</p>
<p>Thanks for signing up. Please verify your email:</p>
<p><a href="{{verification_link}}">Verify Email</a></p>
<p>This link expires at {{expires_at}}.</p>`,
    text: `Hi {{email}},

Thanks for signing up. Please verify your email:
{{verification_link}}

This link expires at {{expires_at}}.`,
    variables: [
      { name: 'email', required: true },
      { name: 'verification_link', required: true },
      { name: 'expires_at', required: true },
    ],
  },
  password_reset: {
    key: 'password_reset',
    subject: 'Reset your password',
    html: `<p>Hi {{email}},</p>
<p>We received a request to reset your password.</p>
<p><a href="{{reset_link}}">Reset Password</a></p>
<p>This link expires at {{expires_at}}.</p>`,
    text: `Hi {{email}},

We received a request to reset your password.
Reset here: {{reset_link}}
This link expires at {{expires_at}}.`,
    variables: [
      { name: 'email', required: true },
      { name: 'reset_link', required: true },
      { name: 'expires_at', required: true },
    ],
  },
  lead_confirmation: {
    key: 'lead_confirmation',
    subject: 'We received your lead - {{niche_name}}',
    html: `<p>Hi {{contact_name}},</p>
<p>We received your request for {{niche_name}}.</p>
<p>Confirm your lead here: <a href="{{confirmation_link}}">Confirm Lead</a></p>
<p>This link expires at {{expires_at}}.</p>`,
    text: `Hi {{contact_name}},

We received your request for {{niche_name}}.
Confirm your lead: {{confirmation_link}}
This link expires at {{expires_at}}.`,
    variables: [
      { name: 'contact_name', required: true },
      { name: 'niche_name', required: true },
      { name: 'confirmation_link', required: true },
      { name: 'expires_at', required: true },
    ],
  },
  lead_confirmation_expired: {
    key: 'lead_confirmation_expired',
    subject: 'Your lead confirmation expired',
    html: `<p>Hi {{contact_name}},</p>
<p>Your lead confirmation for {{niche_name}} has expired.</p>
<p>If you still need service, please submit a new request.</p>`,
    text: `Hi {{contact_name}},

Your lead confirmation for {{niche_name}} has expired.
If you still need service, please submit a new request.`,
    variables: [
      { name: 'contact_name', required: true },
      { name: 'niche_name', required: true },
    ],
  },
  provider_new_lead: {
    key: 'provider_new_lead',
    subject: 'New lead assigned: {{niche_name}}',
    html: `<p>Hi {{provider_name}},</p>
<p>You have a new lead for {{niche_name}}.</p>
<p>Lead ID: {{lead_id}}</p>
<p>Price charged: {{price_charged}}</p>`,
    text: `Hi {{provider_name}},

You have a new lead for {{niche_name}}.
Lead ID: {{lead_id}}
Price charged: {{price_charged}}.`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'niche_name', required: true },
      { name: 'lead_id', required: true },
      { name: 'price_charged', required: true },
    ],
  },
  provider_low_balance: {
    key: 'provider_low_balance',
    subject: 'Low balance alert',
    html: `<p>Hi {{provider_name}},</p>
<p>Your balance is low: {{current_balance}} (threshold: {{threshold}}).</p>
<p>Add funds here: {{deposit_url}}</p>`,
    text: `Hi {{provider_name}},

Your balance is low: {{current_balance}} (threshold: {{threshold}}).
Add funds: {{deposit_url}}`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'current_balance', required: true },
      { name: 'threshold', required: true },
      { name: 'deposit_url', required: false },
    ],
  },
  bad_lead_approved: {
    key: 'bad_lead_approved',
    subject: 'Bad lead approved - refund processed',
    html: `<p>Hi {{provider_name}},</p>
<p>Your bad lead report for {{lead_id}} was approved.</p>
<p>Refund amount: {{refund_amount}}</p>
<p>Admin memo: {{admin_memo}}</p>`,
    text: `Hi {{provider_name}},

Your bad lead report for {{lead_id}} was approved.
Refund amount: {{refund_amount}}
Admin memo: {{admin_memo}}`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'lead_id', required: true },
      { name: 'refund_amount', required: true },
      { name: 'admin_memo', required: false },
    ],
  },
  bad_lead_rejected: {
    key: 'bad_lead_rejected',
    subject: 'Bad lead report rejected',
    html: `<p>Hi {{provider_name}},</p>
<p>Your bad lead report for {{lead_id}} was rejected.</p>
<p>Reason: {{admin_memo}}</p>`,
    text: `Hi {{provider_name}},

Your bad lead report for {{lead_id}} was rejected.
Reason: {{admin_memo}}`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'lead_id', required: true },
      { name: 'admin_memo', required: true },
    ],
  },
  admin_lead_pending: {
    key: 'admin_lead_pending',
    subject: 'Lead pending approval',
    html: `<p>Admin,</p>
<p>A lead is pending approval.</p>
<p>Lead ID: {{lead_id}}</p>
<p>Niche: {{niche_name}}</p>`,
    text: `Admin,

A lead is pending approval.
Lead ID: {{lead_id}}
Niche: {{niche_name}}`,
    variables: [
      { name: 'lead_id', required: true },
      { name: 'niche_name', required: true },
    ],
  },
  lead_approved: {
    key: 'lead_approved',
    subject: 'Your request has been approved!',
    html: `<p>Hi {{contact_name}},</p>
<p>Great news! Your request for {{niche_name}} has been approved.</p>
<p>We're connecting you with qualified providers. You should hear from them within 24-48 hours.</p>
<p>Thank you for using Find Me A Hot Lead!</p>`,
    text: `Hi {{contact_name}},

Great news! Your request for {{niche_name}} has been approved.

We're connecting you with qualified providers. You should hear from them within 24-48 hours.

Thank you for using Find Me A Hot Lead!`,
    variables: [
      { name: 'contact_name', required: true },
      { name: 'niche_name', required: true },
    ],
  },
  lead_rejected: {
    key: 'lead_rejected',
    subject: 'Update on your request',
    html: `<p>Hi {{contact_name}},</p>
<p>Thank you for your interest in {{niche_name}}.</p>
<p>Unfortunately, we're unable to process your request at this time.</p>
<p>Reason: {{rejection_reason}}</p>
<p>If you have questions, please contact our support team.</p>`,
    text: `Hi {{contact_name}},

Thank you for your interest in {{niche_name}}.

Unfortunately, we're unable to process your request at this time.

Reason: {{rejection_reason}}

If you have questions, please contact our support team.`,
    variables: [
      { name: 'contact_name', required: true },
      { name: 'niche_name', required: true },
      { name: 'rejection_reason', required: true },
    ],
  },
}

