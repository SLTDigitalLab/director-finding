import { useState } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { Building2, Users, Upload, ShieldAlert } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-cream to-parchment/50">
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

            <Link to="/login" className="btn-ghost shrink-0 px-4 py-2">
              Login
            </Link>
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
              © 2026 Vision Flow AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
