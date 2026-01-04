/**
 * Invalid token page
 * Shown when confirmation token is invalid or malformed
 */

export default function ConfirmInvalidPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            This confirmation link is invalid
          </h1>
          <p className="text-gray-600 mb-6">
            The confirmation link you clicked is invalid or has already been
            used. Please check your email for the correct link or request a new
            one.
          </p>
          <div className="space-y-4">
            <a
              href="/contact"
              className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-center"
            >
              Contact Support
            </a>
            <p className="text-sm text-gray-500">
              If you believe this is an error, please contact our support team
              for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

