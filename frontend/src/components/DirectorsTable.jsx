import { useState, useEffect } from 'react'
import { User, Trash2, ChevronDown, ChevronUp, RefreshCw, Building2, Pencil } from 'lucide-react'
import { getDirectors, deleteDirector, updateDirector } from '../api/client'
import Modal from './Modal'

export default function DirectorsTable({ refreshKey }) {
  const [directors, setDirectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')
  const [editDirector, setEditDirector] = useState(null)
  const [editForm, setEditForm] = useState({
    full_name: '',
    nic_passport: '',
    residential_address: '',
    email: '',
  })
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getDirectors()
      setDirectors(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [refreshKey])

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const openEdit = (d, e) => {
    e.stopPropagation()
    setEditError('')
    setEditForm({
      full_name: d.full_name,
      nic_passport: d.nic_passport || '',
      residential_address: d.residential_address || '',
      email: d.email || '',
    })
    setEditDirector(d)
  }

  const closeEdit = () => {
    if (!saving) {
      setEditDirector(null)
      setEditError('')
    }
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editDirector) return
    const full_name = editForm.full_name.trim()
    if (!full_name) {
      setEditError('Full name is required.')
      return
    }
    setSaving(true)
    setEditError('')
    try {
      await updateDirector(editDirector.id, {
        full_name,
        nic_passport: editForm.nic_passport.trim() || null,
        residential_address: editForm.residential_address.trim() || null,
        email: editForm.email.trim() || null,
      })
      setEditDirector(null)
      await load()
    } catch (err) {
      const d = err.response?.data?.detail
      setEditError(typeof d === 'string' ? d : 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Remove this director? Company links will also be removed.')) return
    setDeleting(id)
    try {
      await deleteDirector(id)
      await load()
    } finally {
      setDeleting(null)
    }
  }

  const filtered = directors.filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.nic_passport || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-3 py-20 text-ink-500">
        <RefreshCw className="h-5 w-5 animate-spin text-gold" />
        <span className="text-sm font-body">Loading directors…</span>
      </div>
    )
  }

  return (
    <>
      <Modal
        open={Boolean(editDirector)}
        onClose={closeEdit}
        title="Edit director"
        description="Updates this person in the registry. Company links are unchanged."
        titleId="edit-director-title"
        closeDisabled={saving}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 px-5 py-5">
                  {editError && (
                    <p
                      className="rounded-sm border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger"
                      role="alert"
                    >
                      {editError}
                    </p>
                  )}
                  <div>
                    <label className="label mb-1.5 block" htmlFor="dir-name">
                      Full name
                    </label>
                    <input
                      id="dir-name"
                      className="input-field w-full"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 block" htmlFor="dir-nic">
                      NIC / Passport
                    </label>
                    <input
                      id="dir-nic"
                      className="input-field w-full font-mono text-sm"
                      value={editForm.nic_passport}
                      onChange={(e) => setEditForm((f) => ({ ...f, nic_passport: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 block" htmlFor="dir-email">
                      Email
                    </label>
                    <input
                      id="dir-email"
                      type="email"
                      className="input-field w-full"
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 block" htmlFor="dir-addr">
                      Residential address
                    </label>
                    <textarea
                      id="dir-addr"
                      className="input-field min-h-[88px] w-full resize-y font-body text-sm"
                      value={editForm.residential_address}
                      onChange={(e) => setEditForm((f) => ({ ...f, residential_address: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 border-t border-ink-100 pt-4">
                    <button type="submit" disabled={saving} className="btn-primary gap-2">
                      {saving ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        'Save changes'
                      )}
                    </button>
                    <button type="button" onClick={closeEdit} disabled={saving} className="btn-ghost">
                      Cancel
                    </button>
                  </div>
                </form>
      </Modal>

    <div className="animate-fade-in space-y-4">
      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search by name or NIC…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field flex-1 sm:max-w-md"
          autoComplete="off"
        />
        <span className="label whitespace-nowrap sm:ml-auto">
          {filtered.length} of {directors.length}
        </span>
      </div>

      <p className="max-w-3xl text-xs leading-relaxed text-ink-400 font-body">
        Each row is a separate saved record. If two rows look like the same person, older imports often used a slightly
        different name or NIC from the PDF (OCR/typos), so the app created a second record. New uploads reuse an existing
        person when NIC (ignoring spaces), email, or a very close name matches. Remove stray duplicates with the trash
        icon if needed.
      </p>

      {filtered.length === 0 ? (
        <div className="empty-panel">
          <User className="mb-4 h-10 w-10 text-ink-200" />
          <p className="font-body text-sm font-medium text-ink-600">
            {directors.length === 0 ? 'No directors yet' : 'No matches'}
          </p>
          <p className="mt-1 text-sm text-ink-400">
            {directors.length === 0 ? 'Import directors with a Form 1 PDF.' : 'Try another search term.'}
          </p>
        </div>
      ) : (
        <div className="table-shell">
          <div className="grid grid-cols-12 bg-gradient-to-b from-parchment to-parchment/80 px-5 py-3.5">
            <div className="col-span-5 label">Director Name</div>
            <div className="col-span-3 label">NIC / Passport</div>
            <div className="col-span-2 label text-center">Companies</div>
            <div className="col-span-2 label text-right">Actions</div>
          </div>

          {filtered.map((d) => {
            const multi = (d.companies?.length ?? 0) > 1
            return (
            <div key={d.id} className="border-t border-ink-100/90 bg-white first:border-t-0">
              <div
                className={`grid grid-cols-12 cursor-pointer items-center px-5 py-4 transition-colors duration-200 hover:bg-parchment/40
                  ${multi ? 'border-l-[3px] border-l-gold bg-gold/[0.04]' : ''}`}
                onClick={() => toggle(d.id)}
              >
                <div className="col-span-5 flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center border font-mono text-sm font-semibold
                      ${multi ? 'border-gold/50 bg-gold/15 text-gold-dark' : 'border-ink-200 bg-parchment text-ink-600'}`}
                  >
                    {d.full_name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body text-sm font-semibold leading-snug text-ink">{d.full_name}</p>
                      {multi && (
                        <span className="badge-pill-pdf shrink-0 !normal-case">Multi-company</span>
                      )}
                    </div>
                    {d.email && (
                      <p className="mt-0.5 truncate text-xs text-ink-400">{d.email}</p>
                    )}
                  </div>
                </div>
                <div className="col-span-3">
                  <span className="font-mono text-sm text-ink-600">{d.nic_passport || '—'}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="font-mono text-lg font-semibold text-gold tabular-nums">
                    {d.companies?.length ?? 0}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={(e) => openEdit(d, e)}
                    className="btn-icon text-ink-300 hover:text-gold-dark"
                    title="Edit director"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(d.id, e)}
                    disabled={deleting === d.id}
                    className="btn-icon text-ink-300 hover:text-danger disabled:opacity-40"
                    title="Remove director"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {expanded[d.id] ? (
                    <ChevronUp className="mr-1 h-4 w-4 text-ink-400" />
                  ) : (
                    <ChevronDown className="mr-1 h-4 w-4 text-ink-400" />
                  )}
                </div>
              </div>

              {expanded[d.id] && (
                <div className="border-t border-ink-100/80 bg-gradient-to-b from-parchment/50 to-transparent px-5 py-4">
                  {d.companies?.length > 0 ? (
                    <>
                      <p className="label mb-3">Associated Companies</p>
                      <div className="space-y-2">
                        {d.companies.map((co) => (
                          <div
                            key={co.id}
                            className="flex items-center gap-3 border border-ink-100/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,17,23,0.04)]"
                          >
                            <Building2 className="h-4 w-4 flex-shrink-0 text-ink-400" />
                            <div className="min-w-0">
                              <p className="font-body text-sm font-semibold text-ink">{co.name}</p>
                              <span className="tag mt-1 text-xs">{co.company_type}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-ink-400">Not linked to any company.</p>
                  )}

                  {d.residential_address && (
                    <div className="mt-4 border-t border-ink-100/80 pt-4">
                      <p className="label mb-2">Address</p>
                      <p className="text-sm leading-relaxed text-ink-600">{d.residential_address}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
    </>
  )
}