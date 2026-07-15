import { useState } from 'react'

export default function AuthPopup({ onClose, onAuthenticated, isVisible }) {
  const [configMissing, setConfigMissing] = useState(false)

  const handleMicrosoftLogin = () => {
    const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID
    const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID
    const REDIRECT_URI = window.location.origin

    if (!CLIENT_ID || !TENANT_ID) {
      setConfigMissing(true)
      return
    }

    const nonce = Math.random().toString(36).substring(7)
    const state = Math.random().toString(36).substring(7)
    sessionStorage.setItem('auth_state', state)

    const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`
    const authUrl =
      `${AUTHORITY}/oauth2/v2.0/authorize?` +
      `client_id=${CLIENT_ID}` +
      `&response_type=token` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent('User.Read')}` +
      `&response_mode=fragment` +
      `&state=${state}` +
      `&nonce=${nonce}`
    window.location.href = authUrl
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-500">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 animate-[popupEnter_0.6s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="text-center">
          <div className="w-16 h-16 bg-ink rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-8 h-8 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-display font-bold text-ink mb-1">Welcome to</h1>
          <h2 className="text-3xl font-display font-bold text-gold mb-4">Company Registry</h2>
          <p className="text-ink-400 font-body mb-8">Please authenticate to continue</p>

          {configMissing ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
              <p className="text-red-700 font-semibold text-sm">Configuration Required</p>
              <p className="text-red-600 text-xs mt-1">
                Please configure your <code className="bg-red-100 px-1 rounded">.env</code> file with Azure AD credentials
                (<code className="bg-red-100 px-1 rounded">VITE_AZURE_CLIENT_ID</code> and{' '}
                <code className="bg-red-100 px-1 rounded">VITE_AZURE_TENANT_ID</code>).
              </p>
            </div>
          ) : (
            <button
              onClick={handleMicrosoftLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-ink-200 rounded-xl text-ink font-semibold hover:bg-ink-50 hover:border-ink-300 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 23 23" fill="none">
                <rect width="11" height="11" fill="#F25022" />
                <rect x="12" width="11" height="11" fill="#7FBA00" />
                <rect y="12" width="11" height="11" fill="#00A4EF" />
                <rect x="12" y="12" width="11" height="11" fill="#FFB900" />
              </svg>
              Sign in with Microsoft
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
