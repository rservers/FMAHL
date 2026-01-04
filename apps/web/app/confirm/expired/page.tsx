/**
 * Expired token page
 * Shown when confirmation token has expired
 */

'use client'

import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

function ConfirmExpiredContent() {
  const searchParams = useSearchParams()
  const leadId = searchParams.get('lead_id')
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  const handleResend = async () => {
    if (!leadId) {
      setResendError('Lead ID not found')
      return
    }

    setIsResending(true)
    setResendError(null)

    try {
      const response = await fetch(`/api/v1/leads/${leadId}/resend-confirmation`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setResendError(data.error || 'Failed to resend confirmation email')
        return
      }

      setResendSuccess(true)
    } catch (error) {
      setResendError('Network error. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
            <svg
              className="h-6 w-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            This confirmation link has expired
          </h1>
          <p className="text-gray-600 mb-6">
            Confirmation links expire after 24 hours for security reasons.
          </p>

          {leadId && (
            <div className="space-y-4">
              {resendSuccess ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <p className="text-sm text-green-800">
                    A new confirmation email has been sent. Please check your
                    inbox.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleResend}
                    disabled={isResending}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResending ? 'Sending...' : 'Resend Confirmation Email'}
                  </button>
                  {resendError && (
                    <p className="text-sm text-red-600">{resendError}</p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Need help?{' '}
              <a href="/contact" className="text-blue-600 hover:underline">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmExpiredPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ConfirmExpiredContent />
    </Suspense>
  )
}

