import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { Building2, Users, Upload, ShieldAlert } from 'lucide-react'
import { ENABLE_AUTH } from '../utils/constants'
import AuthPopup from './AuthPopup'
import UserProfileDropdown from './UserProfileDropdown'

const HEADER_LOGO = "/logo-header.png";
const FOOTER_LOGO = "/logo-footer.png";

const NAV = [
  { path: "/", label: "Upload PDF", icon: Upload, end: true },
  { path: "/companies", label: "Companies", icon: Building2, end: false },
  { path: "/directors", label: "Directors", icon: Users, end: false },
  { path: "/blacklist", label: "Blacklist", icon: ShieldAlert, end: false },
];

export default function Layout() {
  const [refreshKey, setRefreshKey] = useState(0);
  const onUploadSuccess = () => setRefreshKey((k) => k + 1);

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showAuthPopup, setShowAuthPopup] = useState(false)
  const [isAuthVisible, setIsAuthVisible] = useState(false)
  const [user, setUser] = useState(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  useEffect(() => {
    if (!ENABLE_AUTH) return

    const storedUser = sessionStorage.getItem('azureUser')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      setIsAuthenticated(true)
    }

    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      const errorParam = params.get('error')

      if (errorParam) {
        console.error('Authentication error:', params.get('error_description') || errorParam)
      } else if (accessToken) {
        sessionStorage.setItem('azureToken', accessToken)
        fetchUserProfile(accessToken)
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }
  }, [])

  useEffect(() => {
    if (ENABLE_AUTH && !isAuthenticated) {
      const timer = setTimeout(() => {
        setShowAuthPopup(true)
        setTimeout(() => setIsAuthVisible(true), 10)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated])

  const fetchUserProfile = async (accessToken) => {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (response.ok) {
        const userData = await response.json()
        const userInfo = {
          name: userData.displayName,
          email: userData.mail || userData.userPrincipalName,
          id: userData.id,
        }
        setUser(userInfo)
        setIsAuthenticated(true)
        sessionStorage.setItem('azureUser', JSON.stringify(userInfo))
        handleCloseAuth()
      }
    } catch (err) {
      console.error('Error fetching user profile:', err)
    }
  }

  const handleAuthenticated = (userData) => {
    setUser(userData)
    setIsAuthenticated(true)
    handleCloseAuth()
  }

  const handleCloseAuth = () => {
    setIsAuthVisible(false)
    setTimeout(() => setShowAuthPopup(false), 500)
  }

  const handleLogout = () => {
    setUser(null)
    setIsAuthenticated(false)
    sessionStorage.removeItem('azureUser')
    setShowProfileDropdown(false)
  }

  const handleProfileClick = () => {
    if (!ENABLE_AUTH) return
    if (isAuthenticated) {
      setShowProfileDropdown(!showProfileDropdown)
    } else {
      setShowAuthPopup(true)
      setTimeout(() => setIsAuthVisible(true), 10)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-cream to-parchment/50">
      {ENABLE_AUTH && showAuthPopup && (
        <AuthPopup
          onClose={handleCloseAuth}
          onAuthenticated={handleAuthenticated}
          isVisible={isAuthVisible}
        />
      )}

      <header className="bg-white border-b border-ink-100/90 shadow-panel">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3.5 sm:py-4">
            <Link
              to="/"
              className="flex items-center gap-3 sm:gap-4 min-w-0 rounded-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-gold"
            >
              <img
                src={HEADER_LOGO}
                alt="SLT Mobitel"
                className="h-8 sm:h-9 w-auto max-w-[140px] sm:max-w-[168px] object-contain object-left shrink-0"
              />
              <span
                className="hidden sm:block h-7 w-px bg-ink-100 shrink-0"
                aria-hidden
              />
              <h1 className="font-display text-base sm:text-lg font-semibold tracking-tight text-ink truncate">
                Director Finding
              </h1>
            </Link>

            <div className="relative flex items-center gap-3">
              {ENABLE_AUTH && (
                <button
                  onClick={handleProfileClick}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isAuthenticated ? 'bg-green-500 hover:bg-green-400' : 'bg-ink-600 hover:bg-ink-500'
                  } ${!ENABLE_AUTH ? 'opacity-50 cursor-default' : ''}`}
                  style={{ cursor: ENABLE_AUTH ? 'pointer' : 'default' }}
                >
                  {isAuthenticated && user ? (
                    <span className="text-white font-bold text-sm">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </span>
                  ) : (
                    <svg className="w-5 h-5 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="4" fill="currentColor" />
                      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              )}

              {isAuthenticated && user && (
                <>
                  <div
                    className={`fixed inset-0 z-30 ${showProfileDropdown ? '' : 'pointer-events-none'}`}
                    onClick={() => setShowProfileDropdown(false)}
                  />
                  <UserProfileDropdown
                    user={user}
                    onLogout={handleLogout}
                    isVisible={showProfileDropdown}
                    onClose={() => setShowProfileDropdown(false)}
                  />
                </>
              )}
            </div>
          </div>

          <nav
            className="flex flex-wrap gap-0.5 sm:gap-1 border-t border-ink-100 -mb-px"
            aria-label="Main"
          >
            {NAV.map(({ path, label, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                className={({ isActive }) =>
                  `nav-link flex items-center gap-2 py-3 px-3 sm:px-4 text-sm font-body font-medium whitespace-nowrap
                  transition-colors duration-200 rounded-t-sm
                  ${
                    isActive
                      ? "text-ink active bg-ink-50/80"
                      : "text-ink-400 hover:text-ink hover:bg-ink-50/50"
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5 opacity-90 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <Outlet context={{ refreshKey, onUploadSuccess }} />
      </main>

      <footer className="border-t border-ink-200/80 bg-white/40 backdrop-blur-sm mt-16 sm:mt-24">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <img
            src={FOOTER_LOGO}
            alt="SLT Mobitel"
            className="h-8 w-auto object-contain self-start sm:self-center"
          />
          <div className="flex flex-col gap-1 sm:items-end sm:text-right">
            <p className="text-xs text-ink-500 font-body font-medium">
              Powered by SLT Mobitel
            </p>
            <p className="text-xs text-ink-400 font-body">
              &copy; 2026 Vision Flow AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
