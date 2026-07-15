import { useEffect, useRef } from 'react'
import { LogOut, FileText } from 'lucide-react'

export default function UserProfileDropdown({ user, onLogout, onViewLogs, isVisible, onClose }) {
  const dropdownRef = useRef(null)

  const envAdminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const userEmail = user?.email || ''
  const isAdmin =
    envAdminEmail &&
    userEmail &&
    envAdminEmail.toLowerCase().trim() === userEmail.toLowerCase().trim()

  useEffect(() => {
    if (isVisible) {
      console.log('--- Admin Access Debug ---')
      console.log('User Email:', userEmail)
      console.log('Env Admin Email:', envAdminEmail)
      console.log('Is Admin?', isAdmin)
      console.log('--------------------------')
    }
  }, [isVisible, userEmail, envAdminEmail, isAdmin])

  if (!isVisible) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-ink-200 overflow-hidden z-40 animate-[popupEnter_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
    >
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gold text-ink flex items-center justify-center font-bold text-lg">
          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{user.name || 'User'}</p>
          <p className="text-xs text-ink-400 truncate">{user.email || 'No email'}</p>
        </div>
      </div>
      <div className="h-px bg-ink-100" />

      {isAdmin && (
        <>
          <button
            onClick={() => {
              onViewLogs?.()
              onClose()
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-ink hover:bg-ink-50 transition-colors"
          >
            <FileText className="w-4 h-4 text-ink-400" />
            System Logs
          </button>
          <div className="h-px bg-ink-100" />
        </>
      )}

      <button
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>
    </div>
  )
}
