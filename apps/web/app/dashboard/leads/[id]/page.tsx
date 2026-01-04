/**
 * Admin Lead Detail Page
 * 
 * Shows full lead details and allows approve/reject actions
 * 
 * @see .cursor/docs/Delivery/Epic_03_Admin_Lead_Review_Approval.md
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface LeadDetail {
  id: string
  niche_id: string
  niche_name: string
  status: string
  submitter_name: string
  submitter_email: string
  submitter_phone: string | null
  form_data: any
  attribution: {
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    referrer_url?: string
  }
  confirmation: {
    confirmed_at: string | null
    ip_address: string | null
    user_agent: string | null
  }
  admin_notes: string | null
  created_at: string
}

export default function LeadDetailPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params?.id as string

  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (leadId) {
      fetchLead()
    }
  }, [leadId])

  const fetchLead = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/admin/leads/${leadId}`)
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/login')
          return
        }
        throw new Error('Failed to fetch lead')
      }

      const data = await response.json()
      setLead(data)
      setAdminNotes(data.admin_notes || '')
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/v1/admin/leads/${leadId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: adminNotes || undefined,
          notify_user: false,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve lead')
      }

      router.push('/dashboard/leads')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Rejection reason is required')
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/v1/admin/leads/${leadId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectionReason,
          notes: adminNotes || undefined,
          notify_user: false,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reject lead')
      }

      router.push('/dashboard/leads')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading lead details...</p>
      </div>
    )
  }

  if (error && !lead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/dashboard/leads" className="text-blue-600 hover:underline">
            Back to Leads
          </Link>
        </div>
      </div>
    )
  }

  if (!lead) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold">Find Me A Hot Lead</h1>
            <Link href="/dashboard/leads" className="text-blue-600 hover:underline">
              Back to Leads
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Lead Details</h2>
          <p className="text-sm text-gray-600">Status: <span className="font-semibold capitalize">{lead.status.replace('_', ' ')}</span></p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium">{lead.submitter_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{lead.submitter_email}</p>
              </div>
              {lead.submitter_phone && (
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{lead.submitter_phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Form Data */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Form Data</h3>
            <div className="space-y-3">
              {Object.entries(lead.form_data).map(([key, value]: [string, any]) => (
                <div key={key}>
                  <p className="text-sm text-gray-600">
                    {typeof value === 'object' && value?.label ? value.label : key}
                  </p>
                  <p className="font-medium">
                    {typeof value === 'object' && value?.value !== undefined
                      ? String(value.value)
                      : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Attribution */}
          {(lead.attribution.utm_source ||
            lead.attribution.utm_medium ||
            lead.attribution.referrer_url) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Attribution</h3>
              <div className="space-y-2">
                {lead.attribution.utm_source && (
                  <p className="text-sm">
                    <span className="text-gray-600">UTM Source:</span>{' '}
                    {lead.attribution.utm_source}
                  </p>
                )}
                {lead.attribution.utm_medium && (
                  <p className="text-sm">
                    <span className="text-gray-600">UTM Medium:</span>{' '}
                    {lead.attribution.utm_medium}
                  </p>
                )}
                {lead.attribution.referrer_url && (
                  <p className="text-sm">
                    <span className="text-gray-600">Referrer:</span>{' '}
                    {lead.attribution.referrer_url}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Confirmation Details */}
          {lead.confirmation.confirmed_at && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Confirmation</h3>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="text-gray-600">Confirmed:</span>{' '}
                  {new Date(lead.confirmation.confirmed_at).toLocaleString()}
                </p>
                {lead.confirmation.ip_address && (
                  <p className="text-sm">
                    <span className="text-gray-600">IP:</span>{' '}
                    {lead.confirmation.ip_address}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Admin Actions */}
          {lead.status === 'pending_approval' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Admin Actions</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Notes (optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    rows={3}
                    placeholder="Internal notes for other admins..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason (required for rejection)
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    rows={2}
                    placeholder="Reason for rejection..."
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Processing...' : 'Approve Lead'}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading || !rejectionReason.trim()}
                    className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Processing...' : 'Reject Lead'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

