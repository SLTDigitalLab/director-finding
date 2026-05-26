import { useState, useEffect } from 'react'
import { Building2, Trash2, ChevronDown, ChevronUp, RefreshCw, Pencil } from 'lucide-react'
import { getCompanies, deleteCompany, updateCompany } from '../api/client'
import Modal from './Modal'

export default function CompaniesTable({ refreshKey }) {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [editCompany, setEditCompany] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    company_type: '',
    registered_address: '',
    name_approval_number: '',
  })
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getCompanies()
      setCompanies(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [refreshKey])

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const openEdit = (co, e) => {
    e.stopPropagation()
    setEditError('')
    setEditForm({
      name: co.name,
      company_type: co.company_type || '',
      registered_address: co.registered_address || '',
      name_approval_number: co.name_approval_number || '',
    })
    setEditCompany(co)
  }

  const closeEdit = () => {
    if (!saving) {
      setEditCompany(null)
      setEditError('')
    }
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editCompany) return
    const name = editForm.name.trim()
    if (!name) {
      setEditError('Company name is required.')
      return
    }
    setSaving(true)
    setEditError('')
    try {
      await updateCompany(editCompany.id, {
        name,
        company_type: editForm.company_type.trim() || null,
        registered_address: editForm.registered_address.trim() || null,
        name_approval_number: editForm.name_approval_number.trim() || null,
      })
      setEditCompany(null)
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
    if (!confirm('Delete this company and all its director links?')) return
    setDeleting(id)
    try {
      await deleteCompany(id)
      await load()
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-3 py-20 text-ink-500">
        <RefreshCw className="h-5 w-5 animate-spin text-gold" />
        <span className="text-sm font-body">Loading companies…</span>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="empty-panel">
        <Building2 className="mb-4 h-10 w-10 text-ink-200" />
        <p className="font-body text-sm font-medium text-ink-600">No companies yet</p>
        <p className="mt-1 max-w-sm text-sm text-ink-400">Upload a Form 1 PDF to add your first company.</p>
      </div>
    )
  }

  return (
    <>
      <Modal
        open={Boolean(editCompany)}
        onClose={closeEdit}
        title="Edit company"
        description="Update registry details. Director links are unchanged."
        titleId="edit-company-title"
        closeDisabled={saving}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 px-5 py-5">
              {editError && (
                <p className="rounded-sm border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger" role="alert">
                  {editError}
                </p>
              )}
              <div>
                <label className="label mb-1.5 block" htmlFor="co-name">
                  Company name
                </label>
                <input
                  id="co-name"
                  className="input-field w-full"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  autoComplete="organization"
                  required
                />
              </div>
              <div>
                <label className="label mb-1.5 block" htmlFor="co-type">
                  Company type
                </label>
                <input
                  id="co-type"
                  className="input-field w-full"
                  value={editForm.company_type}
                  onChange={(e) => setEditForm((f) => ({ ...f, company_type: e.target.value }))}
                />
              </div>
              <div>
                <label className="label mb-1.5 block" htmlFor="co-addr">
                  Registered address
                </label>
                <textarea
                  id="co-addr"
                  className="input-field min-h-[88px] w-full resize-y font-body text-sm"
                  value={editForm.registered_address}
                  onChange={(e) => setEditForm((f) => ({ ...f, registered_address: e.target.value }))}
                />
              </div>
              <div>
                <label className="label mb-1.5 block" htmlFor="co-approval">
                  Name approval number
                </label>
                <input
                  id="co-approval"
                  className="input-field w-full font-mono text-sm"
                  value={editForm.name_approval_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, name_approval_number: e.target.value }))}
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

      <div className="table-shell animate-fade-in">
      {/* Header */}
      <div className="grid grid-cols-12 bg-gradient-to-b from-parchment to-parchment/80 px-5 py-3.5">
        <div className="col-span-5 label">Company Name</div>
        <div className="col-span-3 label">Type</div>
        <div className="col-span-2 label text-center">Directors</div>
        <div className="col-span-2 label text-right">Actions</div>
      </div>

      {companies.map((co) => (
        <div key={co.id} className="border-t border-ink-100/90 bg-white first:border-t-0">
          {/* Row */}
          <div
            className="grid grid-cols-12 cursor-pointer items-center px-5 py-4 transition-colors duration-200 hover:bg-parchment/40"
            onClick={() => toggle(co.id)}
          >
            <div className="col-span-5 flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-ink text-cream shadow-panel">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-body text-sm font-semibold leading-snug text-ink">{co.name}</p>
                {co.name_approval_number && (
                  <p className="mt-0.5 font-mono text-xs text-ink-400">#{co.name_approval_number}</p>
                )}
              </div>
            </div>
            <div className="col-span-3">
              <span className="tag text-xs">{co.company_type || '—'}</span>
            </div>
            <div className="col-span-2 text-center">
              <span className="font-mono text-lg font-semibold text-gold tabular-nums">
                {co.directors?.length ?? 0}
              </span>
            </div>
            <div className="col-span-2 flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={(e) => openEdit(co, e)}
                className="btn-icon text-ink-300 hover:text-gold-dark"
                title="Edit company"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(co.id, e)}
                disabled={deleting === co.id}
                className="btn-icon text-ink-300 hover:text-danger disabled:opacity-40"
                title="Delete company"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {expanded[co.id] ? (
                <ChevronUp className="mr-1 h-4 w-4 text-ink-400" />
              ) : (
                <ChevronDown className="mr-1 h-4 w-4 text-ink-400" />
              )}
            </div>
          </div>

          {/* Expanded directors */}
          {expanded[co.id] && co.directors?.length > 0 && (
            <div className="border-t border-ink-100/80 bg-gradient-to-b from-parchment/50 to-transparent px-5 py-4">
              <p className="label mb-3">Directors</p>
              <div className="space-y-2">
                {co.directors.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 border border-ink-100/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,17,23,0.04)]"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center bg-gold/15 font-mono text-xs font-semibold text-gold-dark">
                      {d.full_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-sm font-semibold text-ink">{d.full_name}</p>
                      {d.nic_passport && (
                        <p className="mt-0.5 font-mono text-xs text-ink-400">NIC: {d.nic_passport}</p>
                      )}
                      {d.email && (
                        <p className="mt-0.5 truncate text-xs text-ink-400">{d.email}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expanded — address */}
          {expanded[co.id] && co.registered_address && (
            <div className="border-t border-ink-100/80 bg-white/60 px-5 py-4">
              <p className="label mb-2">Registered Address</p>
              <p className="text-sm leading-relaxed text-ink-600 font-body">{co.registered_address}</p>
            </div>
          )}
        </div>
      ))}
      </div>
    </>
  )
}
