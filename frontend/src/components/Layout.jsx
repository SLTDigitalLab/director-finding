import { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { Building2, Users, Upload, BookOpen, ShieldAlert } from 'lucide-react'

const NAV = [
  { path: '/', label: 'Upload PDF', icon: Upload, end: true },
  { path: '/companies', label: 'Companies', icon: Building2, end: false },
  { path: '/directors', label: 'Directors', icon: Users, end: false },
  { path: '/blacklist', label: 'Blacklist', icon: ShieldAlert, end: false },
]

export default function Layout() {
  const [refreshKey, setRefreshKey] = useState(0)
  const onUploadSuccess = () => setRefreshKey((k) => k + 1)

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-cream to-parchment/50">
      <header className="bg-ink text-cream border-b border-ink-700 shadow-panel">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-4 rounded-sm outline-none ring-offset-ink focus-visible:ring-2 focus-visible:ring-gold"
          >
            <div className="w-11 h-11 bg-gold flex items-center justify-center shadow-[4px_4px_0_0_rgba(201,168,76,0.35)]">
              <BookOpen className="w-5 h-5 text-ink" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-cream">Company Registry</h1>
              <p className="text-xs text-ink-300 font-mono mt-1 tracking-wide">
                Sri Lanka · Form 1 PDF Extractor
              </p>
            </div>
          </Link>
        </div>

        <div className="max-w-6xl mx-auto px-6 border-t border-white/5">
          <nav className="flex gap-1 sm:gap-2 -mb-px" aria-label="Main">
            {NAV.map(({ path, label, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                className={({ isActive }) =>
                  `nav-link flex items-center gap-2 py-3.5 px-3 sm:px-4 text-sm font-body font-medium
                  transition-colors duration-200 rounded-t-sm
                  ${
                    isActive
                      ? 'text-gold active bg-white/[0.07]'
                      : 'text-ink-300 hover:text-cream hover:bg-white/[0.04]'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5 opacity-90" />
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
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-400 font-mono">
            Company Director Registry · {new Date().getFullYear()}
          </p>
          <p className="text-xs text-ink-400 font-body">Built with FastAPI · React · PostgreSQL</p>
        </div>
      </footer>
    </div>
  )
}
