/**
 * Already confirmed page
 * Shown when lead has already been confirmed
 */

export default function AlreadyConfirmedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            This request has already been confirmed
          </h1>
          <p className="text-gray-600 mb-6">
            Your request has already been confirmed and is being reviewed. You
            don&apos;t need to confirm it again.
          </p>
          <p className="text-sm text-gray-500">
            We&apos;ll connect you with qualified providers soon. Expected
            timeline: within 24–48 hours.
          </p>
        </div>
      </div>
    </div>
  )
}

