import { useState, useEffect } from 'react'
import { ShieldAlert, Building2, User, RefreshCw } from 'lucide-react'
import {
  getBlacklistedDirectors,
  getBlacklistedCompanies,
  unblacklistDirector,
  unblacklistCompany,
} from '../api/client'

export default function BlacklistPanel() {
  const [directors, setDirectors] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async () => {
    try {
      const [dirRes, coRes] = await Promise.all([
        getBlacklistedDirectors(),
        getBlacklistedCompanies(),
      ])
      setDirectors(dirRes.data)
      setCompanies(coRes.data)
    } catch (err) {
      console.error('Could not load blacklist data', err)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleUnblacklistDirector = async (id, name) => {
    if (!confirm(`Unblacklist director "${name}"?`)) return
    try {
      await unblacklistDirector(id)
      await loadData()
    } catch (err) {
      alert('Could not unblacklist director.')
    }
  }

  const handleUnblacklistCompany = async (co) => {
    if (!confirm(`Unblacklist company "${co.name}"?\n\nDirectors that were auto-blacklisted by this company will also be unblacklisted.`)) return
    try {
      // If the company is not in the registry yet, we pass its blacklisted_companies ID (co.id)
      // Otherwise, the backend endpoint handles both registry ID and blacklist row ID
      const targetId = co.company_id || co.id
      await unblacklistCompany(targetId)
      await loadData()
    } catch (err) {
      alert('Could not unblacklist company.')
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-3 py-20 text-ink-500">
        <RefreshCw className="h-5 w-5 animate-spin text-gold" />
        <span className="text-sm font-body">Loading blacklist entries…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-xs text-ink-400 font-mono uppercase tracking-wider">
          Registry Status Audit · Live Blacklist database
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-xs font-body font-semibold text-gold-dark hover:text-gold border border-gold/30 hover:border-gold px-3 py-1.5 rounded transition-all duration-200"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Lists
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: Blacklisted Directors */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-ink-100 pb-2">
            <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2">
              <User className="h-4.5 w-4.5 text-danger" />
              Blacklisted Directors ({directors.length})
            </h3>
          </div>

          {directors.length === 0 ? (
            <div className="empty-panel py-12">
              <User className="mb-4 h-10 w-10 text-ink-200" />
              <p className="font-body text-sm font-medium text-ink-600">No blacklisted directors</p>
              <p className="mt-1 max-w-xs text-xs text-ink-400">All registered directors are currently active.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {directors.map((d) => (
                <div
                  key={d.id}
                  className="border border-ink-100/80 border-l-[3px] border-l-danger bg-white p-4 shadow-[0_1px_2px_rgba(15,17,23,0.03)] hover:shadow-panel transition-all duration-200 rounded-sm"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-body text-sm font-bold text-ink leading-snug">{d.full_name}</p>
                        {d.blacklist_auto ? (
                          <span className="inline-flex rounded-sm bg-gold/15 border border-gold/30 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-gold-dark">
                            Auto (Company)
                          </span>
                        ) : (
                          <span className="inline-flex rounded-sm bg-danger-muted border border-danger/20 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-danger">
                            Manual
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-ink-500">ID: {d.nic_passport || '—'}</p>
                      {d.blacklist_company_name && (
                        <p className="text-xs text-ink-500 font-body">
                          <strong>Company:</strong> {d.blacklist_company_name}
                        </p>
                      )}
                      {d.blacklist_reason && (
                        <p className="text-xs text-ink-600 bg-danger-muted/30 border border-danger/10 px-2 py-1 rounded-sm mt-1 font-body">
                          <strong>Reason:</strong> {d.blacklist_reason}
                        </p>
                      )}
                      {d.blacklist_notes && (
                        <p className="text-xs text-ink-500 mt-1 font-body">
                          <strong>Notes:</strong> {d.blacklist_notes}
                        </p>
                      )}
                      {d.companies && d.companies.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-1 items-center">
                          <span className="text-[10px] text-ink-400 font-mono uppercase mr-1">Linked Cos:</span>
                          {d.companies.map((co) => (
                            <span key={co.id} className="inline-flex rounded-sm bg-parchment/60 px-1.5 py-0.5 text-[10px] font-body text-ink-600">
                              {co.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblacklistDirector(d.id, d.full_name)}
                      className="btn-ghost !text-danger hover:!bg-danger-muted/30 text-xs px-2.5 py-1 font-semibold border border-danger/20 hover:border-danger rounded shrink-0"
                    >
                      Unblacklist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Side: Blacklisted Companies */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-ink-100 pb-2">
            <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-gold-dark" />
              Blacklisted Companies ({companies.length})
            </h3>
          </div>

          {companies.length === 0 ? (
            <div className="empty-panel py-12">
              <Building2 className="mb-4 h-10 w-10 text-ink-200" />
              <p className="font-body text-sm font-medium text-ink-600">No blacklisted companies</p>
              <p className="mt-1 max-w-xs text-xs text-ink-400">All companies are currently in good standing.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {companies.map((c) => (
                <div
                  key={c.id}
                  className="border border-ink-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,17,23,0.03)] hover:shadow-panel transition-all duration-200 rounded-sm"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-body text-sm font-bold text-ink leading-snug">{c.name}</p>
                        {c.is_explicit ? (
                          <span className="inline-flex rounded-sm bg-gold/15 border border-gold/30 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-gold-dark">
                            Manual
                          </span>
                        ) : (
                          <span className="inline-flex rounded-sm bg-ink-100 border border-ink-200 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-ink-500">
                            Auto
                          </span>
                        )}
                      </div>
                      {c.reason && (
                        <p className="text-xs text-ink-600 bg-parchment/40 border border-ink-100 px-2 py-1 rounded-sm mt-1 font-body">
                          <strong>Reason:</strong> {c.reason}
                        </p>
                      )}
                      {c.notes && (
                        <p className="text-xs text-ink-500 mt-1 font-body">
                          <strong>Notes:</strong> {c.notes}
                        </p>
                      )}
                    </div>
                    {c.is_explicit ? (
                      <button
                        type="button"
                        onClick={() => handleUnblacklistCompany(c)}
                        className="btn-ghost !text-danger hover:!bg-danger-muted/30 text-xs px-2.5 py-1 font-semibold border border-danger/20 hover:border-danger rounded shrink-0"
                      >
                        Unblacklist
                      </button>
                    ) : (
                      <span className="text-[10px] text-ink-400 font-body italic shrink-0 max-w-[80px] text-right mt-1.5">
                        Managed by Director
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
