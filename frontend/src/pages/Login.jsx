import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ENABLE_AUTH } from '../utils/constants'
import { buildAuthUrl, handleAuthRedirect, getStoredUser } from '../utils/auth'

function getRedirect(searchParams) {
  return searchParams.get('redirect') || '/'
}

export default function Login() {
  const [configMissing, setConfigMissing] = useState(false)
  const [resolving, setResolving] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (!ENABLE_AUTH) {
      navigate('/', { replace: true })
      return
    }

    if (getStoredUser()) {
      navigate(getRedirect(searchParams), { replace: true })
      return
    }

    if (!window.location.hash) return

    setResolving(true)
    handleAuthRedirect().then((user) => {
      setResolving(false)
      if (user) {
        navigate(getRedirect(searchParams), { replace: true })
      }
    })
  }, [navigate, searchParams])

  const handleMicrosoftLogin = () => {
    const authUrl = buildAuthUrl()
    if (!authUrl) {
      setConfigMissing(true)
      return
    }
    window.location.href = authUrl
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cream via-cream to-parchment/50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-ink rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <svg className="w-8 h-8 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-2xl font-display font-bold text-ink mb-1">Welcome to</h1>
            <h2 className="text-3xl font-display font-bold text-gold mb-4">Company Registry</h2>
            <p className="text-ink-400 font-body mb-8">Please authenticate to continue</p>

            {resolving ? (
              <div className="flex items-center justify-center gap-2 text-ink-400 text-sm font-body">
                <Loader2 className="w-4 h-4 animate-spin" />
                Authenticating...
              </div>
            ) : configMissing ? (
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
    </div>
  )
}