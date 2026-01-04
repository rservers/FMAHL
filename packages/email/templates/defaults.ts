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
  subscription_deactivated: {
    key: 'subscription_deactivated',
    subject: 'Subscription deactivated - insufficient balance',
    html: '<p>Hi {{provider_name}},</p>\n<p>Your subscription to the <strong>{{level_name}}</strong> competition level has been deactivated due to insufficient balance.</p>\n<p>Price per lead: ${{price_per_lead}}</p>\n<p>Please add funds to your account to reactivate this subscription and continue receiving leads.</p>\n<p>Add funds: <a href="{{deposit_url}}">Add Funds</a></p>',
    text: 'Hi {{provider_name}},\n\nYour subscription to the {{level_name}} competition level has been deactivated due to insufficient balance.\n\nPrice per lead: ${{price_per_lead}}\n\nPlease add funds to your account to reactivate this subscription and continue receiving leads.\n\nAdd funds: {{deposit_url}}',
    variables: [
      { name: 'provider_name', required: true },
      { name: 'level_name', required: true },
      { name: 'price_per_lead', required: true },
      { name: 'deposit_url', required: false },
    ],
  },
  subscription_reactivated: {
    key: 'subscription_reactivated',
    subject: 'Subscription reactivated',
    html: `<p>Hi {{provider_name}},</p>
<p>Great news! Your subscription to the <strong>{{level_name}}</strong> competition level has been reactivated.</p>
<p>You will now receive leads from this competition level again.</p>`,
    text: `Hi {{provider_name}},

Great news! Your subscription to the {{level_name}} competition level has been reactivated.

You will now receive leads from this competition level again.`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'level_name', required: true },
    ],
  },
  filter_updated: {
    key: 'filter_updated',
    subject: 'Your lead filters have been updated',
    html: `<p>Hi {{provider_name}},</p>
<p>Your filters for the <strong>{{level_name}}</strong> competition level have been successfully updated.</p>
<p>Summary: {{filter_summary}}</p>
<p>You can view and manage your filters in your provider dashboard.</p>`,
    text: `Hi {{provider_name}},

Your filters for the {{level_name}} competition level have been successfully updated.

Summary: {{filter_summary}}

You can view and manage your filters in your provider dashboard.`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'level_name', required: true },
      { name: 'filter_summary', required: true },
    ],
  },
  filter_invalidated: {
    key: 'filter_invalidated',
    subject: 'Action required: Your filters need to be updated',
    html: `<p>Hi {{provider_name}},</p>
<p>The form schema for the <strong>{{level_name}}</strong> competition level has been updated, and your current filters are no longer valid.</p>
<p>Please update your filters in your provider dashboard to continue receiving leads.</p>
<p>You will not receive leads until your filters are updated.</p>`,
    text: `Hi {{provider_name}},

The form schema for the {{level_name}} competition level has been updated, and your current filters are no longer valid.

Please update your filters in your provider dashboard to continue receiving leads.

You will not receive leads until your filters are updated.`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'level_name', required: true },
    ],
  },
  deposit_completed: {
    key: 'deposit_completed',
    subject: 'Deposit completed successfully',
    html: `<p>Hi {{provider_name}},</p>
<p>Your deposit of <strong>{{amount}} {{currency}}</strong> has been completed successfully.</p>
<p>Your account balance has been updated. You can now receive leads.</p>
<p>View your billing history: <a href="{{billing_url}}">Billing History</a></p>`,
    text: `Hi {{provider_name}},

Your deposit of {{amount}} {{currency}} has been completed successfully.

Your account balance has been updated. You can now receive leads.

View your billing history: {{billing_url}}`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'amount', required: true },
      { name: 'currency', required: true },
      { name: 'billing_url', required: false },
    ],
  },
  low_balance_alert: {
    key: 'low_balance_alert',
    subject: 'Low balance alert',
    html: `<p>Hi {{provider_name}},</p>
<p>Your account balance is below your threshold of <strong>{{threshold}} {{currency}}</strong>.</p>
<p>Current balance: <strong>{{balance}} {{currency}}</strong></p>
<p>Please add funds to avoid service interruption. <a href="{{deposit_url}}">Add Funds</a></p>`,
    text: `Hi {{provider_name}},

Your account balance is below your threshold of {{threshold}} {{currency}}.

Current balance: {{balance}} {{currency}}

Please add funds to avoid service interruption. Add funds: {{deposit_url}}`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'balance', required: true },
      { name: 'threshold', required: true },
      { name: 'currency', required: true },
      { name: 'deposit_url', required: false },
    ],
  },
  refund_processed: {
    key: 'refund_processed',
    subject: 'Refund processed',
    html: `<p>Hi {{provider_name}},</p>
<p>A refund of <strong>{{amount}} {{currency}}</strong> has been processed for your account.</p>
<p>Reason: {{refund_reason}}</p>
<p>Your account balance has been updated.</p>
<p>View your billing history: <a href="{{billing_url}}">Billing History</a></p>`,
    text: `Hi {{provider_name}},

A refund of {{amount}} {{currency}} has been processed for your account.

Reason: {{refund_reason}}

Your account balance has been updated.

View your billing history: {{billing_url}}`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'amount', required: true },
      { name: 'currency', required: true },
      { name: 'refund_reason', required: true },
      { name: 'billing_url', required: false },
    ],
  },
  lead_assigned: {
    key: 'lead_assigned',
    subject: 'New Lead Assigned - {{niche_name}}',
    html: '<p>Hi {{provider_name}},</p>\n<p>You have been assigned a new lead!</p>\n<p><strong>Competition Level:</strong> {{level_name}}</p>\n<p><strong>Amount Charged:</strong> ${{price_charged}}</p>\n<p>View the lead details in your dashboard.</p>\n<p><a href="{{dashboard_url}}">View Lead</a></p>',
    text: 'Hi {{provider_name}},\n\nYou have been assigned a new lead!\n\nCompetition Level: {{level_name}}\nAmount Charged: ${{price_charged}}\n\nView the lead details in your dashboard: {{dashboard_url}}',
    variables: [
      { name: 'provider_name', required: true },
      { name: 'niche_name', required: true },
      { name: 'level_name', required: true },
      { name: 'price_charged', required: true },
      { name: 'dashboard_url', required: false },
    ],
  },
  admin_provider_rejected_lead: {
    key: 'admin_provider_rejected_lead',
    subject: 'Provider Rejected Lead - {{niche_name}}',
    html: `<p>Hello Admin,</p>
<p>A provider has rejected a lead assignment.</p>
<p><strong>Provider:</strong> {{provider_name}}</p>
<p><strong>Lead ID:</strong> {{lead_id}}</p>
<p><strong>Niche:</strong> {{niche_name}}</p>
<p><strong>Rejection Reason:</strong> {{rejection_reason}}</p>
<p><strong>Rejected At:</strong> {{rejected_at}}</p>
<p>Review the lead in the admin dashboard.</p>`,
    text: `Hello Admin,

A provider has rejected a lead assignment.

Provider: {{provider_name}}
Lead ID: {{lead_id}}
Niche: {{niche_name}}
Rejection Reason: {{rejection_reason}}
Rejected At: {{rejected_at}}

Review the lead in the admin dashboard.`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'lead_id', required: true },
      { name: 'niche_name', required: true },
      { name: 'rejection_reason', required: true },
      { name: 'rejected_at', required: true },
    ],
  },
  lead_export_ready: {
    key: 'lead_export_ready',
    subject: 'Your Lead Export is Ready',
    html: `<p>Hi {{provider_name}},</p>
<p>Your lead export is ready for download.</p>
<p><strong>Export Date:</strong> {{export_date}}</p>
<p><strong>Rows:</strong> {{row_count}}</p>
<p><a href="{{download_url}}">Download CSV</a></p>
<p>This link expires at {{expires_at}}.</p>`,
    text: `Hi {{provider_name}},

Your lead export is ready for download.

Export Date: {{export_date}}
Rows: {{row_count}}

Download CSV: {{download_url}}

This link expires at {{expires_at}}.`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'export_date', required: true },
      { name: 'row_count', required: true },
      { name: 'download_url', required: true },
      { name: 'expires_at', required: true },
    ],
  },
  bad_lead_reported_confirmation: {
    key: 'bad_lead_reported_confirmation',
    subject: 'Bad Lead Report Received - {{niche_name}}',
    html: `<p>Hi {{provider_name}},</p>
<p>We've received your bad lead report for lead {{lead_id}} ({{niche_name}}).</p>
<p><strong>Reported At:</strong> {{reported_at}}</p>
<p>Our team will review your request within 24-48 hours. You'll receive an email notification once the review is complete.</p>
<p>Thank you for helping us maintain lead quality.</p>`,
    text: `Hi {{provider_name}},

We've received your bad lead report for lead {{lead_id}} ({{niche_name}}).

Reported At: {{reported_at}}

Our team will review your request within 24-48 hours. You'll receive an email notification once the review is complete.

Thank you for helping us maintain lead quality.`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'lead_id', required: true },
      { name: 'niche_name', required: true },
      { name: 'reported_at', required: true },
    ],
  },
  bad_lead_approved: {
    key: 'bad_lead_approved',
    subject: 'Bad Lead Refund Approved - {{niche_name}}',
    html: `<p>Hi {{provider_name}},</p>
<p>Your bad lead report for lead {{lead_id}} ({{niche_name}}) has been approved.</p>
<p><strong>Refund Amount:</strong> ${{refund_amount}}</p>
<p><strong>Refunded At:</strong> {{refunded_at}}</p>
<p><strong>New Balance:</strong> ${{new_balance}}</p>
<p><strong>Admin Notes:</strong> {{admin_memo}}</p>
<p>The refund has been credited to your account balance.</p>`,
    text: `Hi {{provider_name}},

Your bad lead report for lead {{lead_id}} ({{niche_name}}) has been approved.

Refund Amount: ${{refund_amount}}
Refunded At: {{refunded_at}}
New Balance: ${{new_balance}}

Admin Notes: {{admin_memo}}

The refund has been credited to your account balance.`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'lead_id', required: true },
      { name: 'niche_name', required: true },
      { name: 'refund_amount', required: true },
      { name: 'refunded_at', required: true },
      { name: 'new_balance', required: true },
      { name: 'admin_memo', required: true },
    ],
  },
  bad_lead_rejected: {
    key: 'bad_lead_rejected',
    subject: 'Bad Lead Report Review - {{niche_name}}',
    html: `<p>Hi {{provider_name}},</p>
<p>Your bad lead report for lead {{lead_id}} ({{niche_name}}) has been reviewed.</p>
<p><strong>Status:</strong> Rejected</p>
<p><strong>Reviewed At:</strong> {{reviewed_at}}</p>
<p><strong>Admin Notes:</strong> {{admin_memo}}</p>
<p>If you have additional concerns about this lead, please contact our support team.</p>`,
    text: `Hi {{provider_name}},

Your bad lead report for lead {{lead_id}} ({{niche_name}}) has been reviewed.

Status: Rejected
Reviewed At: {{reviewed_at}}

Admin Notes: {{admin_memo}}

If you have additional concerns about this lead, please contact our support team.`,
    variables: [
      { name: 'provider_name', required: true },
      { name: 'lead_id', required: true },
      { name: 'niche_name', required: true },
      { name: 'admin_memo', required: true },
      { name: 'reviewed_at', required: true },
    ],
  },
}

