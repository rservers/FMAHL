/**
 * Confirmation success page
 * Shown after successful lead confirmation
 */

export default function ConfirmSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Thank you for confirming your request!
          </h1>
          <p className="text-gray-600 mb-4">
            We&apos;re reviewing your submission and will connect you with
            qualified providers soon.
          </p>
          <p className="text-sm text-gray-500">
            Expected timeline: within 24–48 hours
          </p>
        </div>
      </div>
    </div>
  )
}

