/**
 * Confirmation landing page
 * Redirects to appropriate page based on token validation
 */

import { redirect } from 'next/navigation'

export default function ConfirmPage() {
  // This page should not be accessed directly
  // Users should come via /api/v1/leads/confirm?token=...
  redirect('/confirm/invalid')
}

