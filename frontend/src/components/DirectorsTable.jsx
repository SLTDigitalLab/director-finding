import { useState, useEffect } from 'react'
import {
  User,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Building2,
  Pencil,
  Plus,
  ShieldAlert,
} from 'lucide-react'
import {
  getDirectors,
  createDirector,
  deleteDirector,
  updateDirector,
  getBlacklistedCompanies,
  suggestCompaniesForNic,
  unlinkDirectorFromCompany,
  blacklistDirector,
  unblacklistDirector,
} from '../api/client'
import Modal from './Modal'

const emptyForm = {
  full_name: '',
  nic_passport: '',
  id_type: '',
  id_country: '',
  residential_address: '',
  email: '',
  status: 'active',
  blacklist_company_name: '',
  blacklist_reason: '',
  blacklist_notes: '',
}

function directorToForm(d) {
  return {
    full_name: d.full_name,
    nic_passport: d.nic_passport || '',
    id_type: d.id_type || '',
    id_country: d.id_country || '',
    residential_address: d.residential_address || '',
    email: d.email || '',
    status: d.is_blacklisted ? 'blacklisted' : 'active',
    blacklist_company_name: d.blacklist_company_name || d.companies?.[0]?.name || '',
    blacklist_reason: d.blacklist_reason || '',
    blacklist_notes: d.blacklist_notes || '',
  }
}

function formToPayload(form) {
  const isPassport = form.id_type === 'PASSPORT'
  const isBlacklisted = form.status === 'blacklisted'
  return {
    full_name: form.full_name.trim(),
    nic_passport: form.nic_passport.trim() || null,
    id_type: form.id_type || null,
    id_country: isPassport ? form.id_country.trim() || null : null,
    residential_address: form.residential_address.trim() || null,
    email: form.email.trim() || null,
    is_blacklisted: isBlacklisted,
    blacklist_company_name: isBlacklisted ? form.blacklist_company_name.trim() || null : null,
    blacklist_reason: isBlacklisted ? form.blacklist_reason.trim() || null : null,
    blacklist_notes: isBlacklisted ? form.blacklist_notes.trim() || null : null,
  }
}

function DirectorFormFields({ form, setForm, formError, companySuggestions, onNicBlur }) {
  const isPassport = form.id_type === 'PASSPORT'
  const isBlacklisted = form.status === 'blacklisted'

  return (
    <>
      {formError && (
        <p
          className="rounded-sm border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {formError}
        </p>
      )}
      <div>
        <label className="label mb-1.5 block" htmlFor="dir-status">
          Status <span className="text-danger">*</span>
        </label>
        <select
          id="dir-status"
          className="input-field w-full"
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="active">Active (not blacklisted)</option>
          <option value="blacklisted">Blacklisted</option>
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label mb-1.5 block" htmlFor="dir-id-type">
            ID type
            <span className="ml-1 text-ink-400 font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <select
            id="dir-id-type"
            className="input-field w-full"
            value={form.id_type}
            onChange={(e) => {
              const v = e.target.value
              setForm((f) => ({
                ...f,
                id_type: v,
                id_country: v === 'PASSPORT' ? f.id_country : '',
              }))
            }}
          >
            <option value="">Not specified</option>
            <option value="NIC">NIC</option>
            <option value="PASSPORT">Passport</option>
          </select>
        </div>
        {isPassport && (
          <div>
            <label className="label mb-1.5 block" htmlFor="dir-country">
              Country <span className="text-danger">*</span>
            </label>
            <input
              id="dir-country"
              className="input-field w-full"
              value={form.id_country}
              onChange={(e) => setForm((f) => ({ ...f, id_country: e.target.value }))}
              placeholder="e.g. India"
            />
          </div>
        )}
      </div>
      <div>
        <label className="label mb-1.5 block" htmlFor="dir-nic">
          {isPassport ? 'Passport number' : form.id_type === 'NIC' ? 'NIC number' : 'NIC / Passport'}
          <span className="ml-1 text-ink-400 font-normal normal-case tracking-normal">(optional — can add later)</span>
        </label>
        <input
          id="dir-nic"
          className="input-field w-full font-mono text-sm"
          value={form.nic_passport}
          onChange={(e) => setForm((f) => ({ ...f, nic_passport: e.target.value }))}
          onBlur={onNicBlur}
          placeholder={isPassport ? 'e.g. Z 4212133' : 'e.g. 123456789V'}
        />
      </div>
      <div>
        <label className="label mb-1.5 block" htmlFor="dir-name">
          Full name <span className="text-danger">*</span>
        </label>
        <input
          id="dir-name"
          className="input-field w-full"
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          required
        />
      </div>
      {isBlacklisted && (
        <>
          <div>
            <label className="label mb-1.5 block" htmlFor="dir-bl-company">
              Company to blacklist <span className="text-danger">*</span>
            </label>
            <input
              id="dir-bl-company"
              className="input-field w-full"
              value={form.blacklist_company_name}
              onChange={(e) => setForm((f) => ({ ...f, blacklist_company_name: e.target.value }))}
              list="dir-company-suggestions"
              required
              placeholder="Company this director is linked to"
            />
            <datalist id="dir-company-suggestions">
              {companySuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label mb-1.5 block" htmlFor="dir-bl-reason">
              Blacklist reason
            </label>
            <input
              id="dir-bl-reason"
              className="input-field w-full"
              value={form.blacklist_reason}
              onChange={(e) => setForm((f) => ({ ...f, blacklist_reason: e.target.value }))}
            />
          </div>
          <div>
            <label className="label mb-1.5 block" htmlFor="dir-bl-notes">
              Notes
            </label>
            <textarea
              id="dir-bl-notes"
              className="input-field min-h-[72px] w-full resize-y font-body text-sm"
              value={form.blacklist_notes}
              onChange={(e) => setForm((f) => ({ ...f, blacklist_notes: e.target.value }))}
            />
          </div>
        </>
      )}
      <div>
        <label className="label mb-1.5 block" htmlFor="dir-email">
          Email
        </label>
        <input
          id="dir-email"
          type="email"
          className="input-field w-full"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </div>
      <div>
        <label className="label mb-1.5 block" htmlFor="dir-addr">
          Residential address
        </label>
        <textarea
          id="dir-addr"
          className="input-field min-h-[88px] w-full resize-y font-body text-sm"
          value={form.residential_address}
          onChange={(e) => setForm((f) => ({ ...f, residential_address: e.target.value }))}
        />
      </div>
    </>
  )
}

export default function DirectorsTable({ refreshKey, variant = 'registry' }) {
  const isBlacklistPage = variant === 'blacklist'
  const [directors, setDirectors] = useState([])
  const [blacklistedCompanies, setBlacklistedCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(isBlacklistPage ? 'blacklisted' : 'all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [companySuggestions, setCompanySuggestions] = useState([])
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Inline Blacklist Form State
  const [inlineBlacklistId, setInlineBlacklistId] = useState(null)
  const [inlineForm, setInlineForm] = useState({ reason: '', notes: '' })
  const [inlineError, setInlineError] = useState('')
  const [inlineSaving, setInlineSaving] = useState(false)

  const handleBlacklistSubmit = async (id) => {
    const reason = inlineForm.reason.trim()
    if (!reason) {
      setInlineError('Reason is required.')
      return
    }
    setInlineSaving(true)
    setInlineError('')
    try {
      await blacklistDirector(id, {
        reason,
        notes: inlineForm.notes.trim() || null,
      })
      setInlineBlacklistId(null)
      setInlineForm({ reason: '', notes: '' })
      await load()
    } catch (err) {
      const d = err.response?.data?.detail
      setInlineError(typeof d === 'string' ? d : 'Could not blacklist director.')
    } finally {
      setInlineSaving(false)
    }
  }

  const handleUnblacklist = async (id) => {
    if (!confirm('Unblacklist this director? Their auto-blacklisted companies will be evaluated for removal.')) return
    try {
      await unblacklistDirector(id)
      await load()
    } catch (err) {
      alert('Could not unblacklist director.')
    }
  }


  const load = async () => {
    setLoading(true)
    try {
      const apiStatus = statusFilter === 'all' ? undefined : statusFilter
      const [dirRes, coRes] = await Promise.all([
        getDirectors(apiStatus),
        getBlacklistedCompanies().catch(() => ({ data: [] })),
      ])
      setDirectors(dirRes.data)
      setBlacklistedCompanies(coRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [refreshKey, statusFilter])

  const loadCompanySuggestions = async (nic) => {
    const trimmed = nic.trim()
    if (!trimmed) {
      setCompanySuggestions([])
      return
    }
    try {
      const res = await suggestCompaniesForNic(trimmed)
      const names = res.data.companies || []
      setCompanySuggestions(names)
      if (names.length === 1 && !form.blacklist_company_name) {
        setForm((f) => ({ ...f, blacklist_company_name: names[0] }))
      }
    } catch {
      setCompanySuggestions([])
    }
  }

  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }))

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...emptyForm,
      status: isBlacklistPage ? 'blacklisted' : 'active',
    })
    setCompanySuggestions([])
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (d, e) => {
    e.stopPropagation()
    setEditing(d)
    setForm(directorToForm(d))
    setCompanySuggestions([])
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (!saving) {
      setModalOpen(false)
      setEditing(null)
      setFormError('')
    }
  }

  const validateForm = () => {
    if (!form.full_name.trim()) return 'Full name is required.'
    if (form.nic_passport.trim() && !form.id_type) {
      return 'Please select ID type (NIC or Passport) for the ID number you entered.'
    }
    if (form.id_type === 'PASSPORT' && form.nic_passport.trim() && !form.id_country.trim()) {
      return 'Country is required for passport IDs.'
    }
    if (form.status === 'blacklisted' && !form.blacklist_company_name.trim()) {
      return 'Company name is required when blacklisting (company is blacklisted too).'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validateForm()
    if (err) {
      setFormError(err)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload = formToPayload(form)
      if (editing) {
        await updateDirector(editing.id, payload)
      } else {
        await createDirector(payload)
      }
      setModalOpen(false)
      setEditing(null)
      await load()
    } catch (ex) {
      const d = ex.response?.data?.detail
      setFormError(typeof d === 'string' ? d : 'Could not save.')
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

  const handleUnlinkDirector = async (companyId, directorId, directorName, companyName) => {
    if (!confirm(`Remove director "${directorName}" from company "${companyName}"?`)) return
    try {
      await unlinkDirectorFromCompany(companyId, directorId)
      await load()
    } catch (err) {
      alert('Could not remove director from company.')
    }
  }

  const filtered = directors.filter(
    (d) =>
      d.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.nic_passport || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.blacklist_company_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const filterBtn = (value, label) => (
    <button
      type="button"
      onClick={() => setStatusFilter(value)}
      className={`rounded-sm border px-3 py-1.5 text-xs font-body font-medium transition-colors
        ${
          statusFilter === value
            ? 'border-ink bg-ink text-cream'
            : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
        }`}
    >
      {label}
    </button>
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
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit director' : 'Add director'}
        description={
          form.status === 'blacklisted'
            ? 'Blacklisted directors appear on the Blacklist page; their company is blacklisted too.'
            : 'NIC/passport is the preferred ID for matching. If not yet available, the director can be matched by name + email instead.'
        }
        titleId="director-form-title"
        closeDisabled={saving}
      >
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <DirectorFormFields
            form={form}
            setForm={setForm}
            formError={formError}
            companySuggestions={companySuggestions}
            onNicBlur={() => loadCompanySuggestions(form.nic_passport)}
          />
          <div className="flex flex-wrap gap-3 border-t border-ink-100 pt-4">
            <button type="submit" disabled={saving} className="btn-primary gap-2">
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editing ? (
                'Save changes'
              ) : (
                'Add director'
              )}
            </button>
            <button type="button" onClick={closeModal} disabled={saving} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <div className="animate-fade-in space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            placeholder="Search name, NIC, or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field flex-1 lg:max-w-md"
            autoComplete="off"
          />
          <div className="flex flex-wrap items-center gap-2">
            {!isBlacklistPage && filterBtn('all', 'All')}
            {filterBtn('blacklisted', 'Blacklisted')}
            {!isBlacklistPage && filterBtn('active', 'Not blacklisted')}
          </div>
          <button type="button" onClick={openCreate} className="btn-primary shrink-0 gap-2 lg:ml-auto">
            <Plus className="h-4 w-4" />
            Add director
          </button>
        </div>

        <p className="max-w-3xl text-xs leading-relaxed text-ink-400 font-body">
          One record per person. Matched by <strong className="text-ink-600">NIC / Passport</strong> when available,
          or by <strong className="text-ink-600">full name + email</strong> as a fallback. IDs can be added to a
          director's record at any time. Set status to <strong className="text-ink-600">Blacklisted</strong> to
          include them on the Blacklist page and block their company on PDF upload.
        </p>

        {isBlacklistPage && blacklistedCompanies.length > 0 && (
          <div className="rounded-sm border border-danger/20 bg-danger-muted/30 px-4 py-3">
            <p className="label mb-2 text-danger">Blacklisted companies ({blacklistedCompanies.length})</p>
            <div className="flex flex-wrap gap-2">
              {blacklistedCompanies.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex rounded-sm border border-danger/25 bg-white px-2.5 py-1 text-xs font-body font-medium text-ink-700"
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <span className="label block">
          {filtered.length} director{filtered.length !== 1 ? 's' : ''}
        </span>

        {filtered.length === 0 ? (
          <div className="empty-panel">
            <User className="mb-4 h-10 w-10 text-ink-200" />
            <p className="font-body text-sm font-medium text-ink-600">No directors found</p>
          </div>
        ) : (
          <div className="table-shell">
            <div className="grid grid-cols-12 bg-gradient-to-b from-parchment to-parchment/80 px-5 py-3.5">
              <div className="col-span-2 label">Status</div>
              <div className="col-span-2 label">NIC / Passport</div>
              <div className="col-span-3 label">Name</div>
              <div className="col-span-2 label">Company</div>
              <div className="col-span-1 label text-center">Cos.</div>
              <div className="col-span-2 label text-right">Actions</div>
            </div>

            {filtered.map((d) => {
              const multi = (d.companies?.length ?? 0) > 1
              const bl = d.is_blacklisted
              return (
                <div
                  key={d.id}
                  className={`border-t border-ink-100/90 bg-white first:border-t-0 ${
                    bl ? 'border-l-[3px] border-l-danger/70' : ''
                  }`}
                >
                  <div
                    className={`grid grid-cols-12 cursor-pointer items-center px-5 py-4 transition-colors hover:bg-parchment/40
                      ${multi && !bl ? 'border-l-[3px] border-l-gold bg-gold/[0.04]' : ''}`}
                    onClick={() => toggle(d.id)}
                  >
                    <div className="col-span-2">
                      {bl ? (
                        <span className="inline-flex items-center gap-1 rounded-sm border border-danger/30 bg-danger-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-danger">
                          <ShieldAlert className="h-3 w-3" />
                          {d.blacklist_auto ? 'Auto' : 'Blacklisted'}
                        </span>
                      ) : (
                        <span className="tag !normal-case text-ink-500">Active</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="font-mono text-sm font-semibold text-ink-800">{d.nic_passport || '—'}</span>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <p className="font-body text-sm font-semibold leading-snug text-ink">{d.full_name}</p>
                      {d.email && <p className="mt-0.5 truncate text-xs text-ink-400">{d.email}</p>}
                    </div>
                    <div className="col-span-2 min-w-0">
                      <p className="truncate text-sm text-ink-600 font-body">
                        {d.blacklist_company_name || d.companies?.[0]?.name || '—'}
                      </p>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="font-mono text-sm font-semibold text-gold tabular-nums">
                        {d.companies?.length ?? 0}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {bl ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUnblacklist(d.id)
                          }}
                          className="btn-icon text-danger hover:text-danger-dark"
                          title="Unblacklist director"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpanded((p) => ({ ...p, [d.id]: true }))
                            setInlineBlacklistId(d.id)
                            setInlineForm({ reason: '', notes: '' })
                            setInlineError('')
                          }}
                          className="btn-icon text-ink-300 hover:text-gold-dark"
                          title="Blacklist director"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                        </button>
                      )}
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
                          <p className="label mb-3">Associated companies</p>
                          <div className="space-y-2">
                            {d.companies.map((co) => (
                              <div
                                key={co.id}
                                className="flex items-center justify-between border border-ink-100/80 bg-white px-4 py-3"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <Building2 className="h-4 w-4 shrink-0 text-ink-400" />
                                  <p className="font-body text-sm font-semibold text-ink truncate">{co.name}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUnlinkDirector(co.id, d.id, d.full_name, co.name)
                                  }}
                                  className="text-xs font-semibold text-danger hover:text-danger-dark px-2.5 py-1 hover:bg-danger-muted/30 rounded transition-colors shrink-0"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-ink-400">Not linked to any company in the registry.</p>
                      )}
                      {d.residential_address && (
                        <div className="mt-4 border-t border-ink-100/80 pt-4">
                          <p className="label mb-2">Address</p>
                          <p className="text-sm leading-relaxed text-ink-600 font-body">{d.residential_address}</p>
                        </div>
                      )}

                      {/* Blacklist details / Inline form section */}
                      {bl ? (
                        <div className="mt-4 border-t border-ink-100/80 pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="label text-danger">Blacklisted Director Details</p>
                                {d.blacklist_auto && (
                                  <span className="inline-flex rounded-sm bg-gold/15 border border-gold/30 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-gold-dark">
                                    Auto (Company)
                                  </span>
                                )}
                              </div>
                              {d.blacklist_company_name && (
                                <p className="text-xs text-ink-500 mt-1 font-body">
                                  <strong>Company:</strong> {d.blacklist_company_name}
                                </p>
                              )}
                              {d.blacklist_reason && (
                                <p className="text-sm text-ink-600 mt-1 font-body">
                                  <strong>Reason:</strong> {d.blacklist_reason}
                                </p>
                              )}
                              {d.blacklist_notes && (
                                <p className="text-sm text-ink-500 mt-1 font-body">
                                  <strong>Notes:</strong> {d.blacklist_notes}
                                </p>
                              )}
                              {d.blacklist_auto && (
                                <p className="text-xs text-ink-400 mt-2 font-body italic">
                                  Auto-blacklisted because their company was blacklisted. Unblacklisting the company will also unblacklist this director.
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnblacklist(d.id)}
                              className="btn-ghost !text-danger hover:!bg-danger-muted/30 text-xs px-3 py-1.5 font-semibold border border-danger/30 hover:border-danger rounded shrink-0"
                            >
                              Unblacklist Director
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 border-t border-ink-100/80 pt-4">
                          {inlineBlacklistId !== d.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setInlineBlacklistId(d.id)
                                setInlineForm({ reason: '', notes: '' })
                                setInlineError('')
                              }}
                              className="btn-ghost text-xs px-3 py-1.5 hover:bg-danger-muted/30 hover:text-danger hover:border-danger/30 border border-ink-200 rounded font-semibold"
                            >
                              Blacklist Director
                            </button>
                          ) : (
                            <div className="space-y-3 max-w-md border border-danger/20 bg-danger-muted/5 p-4 rounded-sm">
                              <p className="label text-danger">Blacklist Director</p>
                              {inlineError && (
                                <p className="rounded-sm border border-danger/30 bg-danger-muted px-3 py-1.5 text-xs text-danger" role="alert">
                                  {inlineError}
                                </p>
                              )}
                              <div>
                                <label className="label mb-1.5 block" htmlFor={`bl-reason-${d.id}`}>
                                  Reason <span className="text-danger">*</span>
                                </label>
                                <input
                                  id={`bl-reason-${d.id}`}
                                  className="input-field w-full text-sm"
                                  value={inlineForm.reason}
                                  onChange={(e) => setInlineForm((f) => ({ ...f, reason: e.target.value }))}
                                  placeholder="e.g. Failure to comply with regulations"
                                  required
                                />
                              </div>
                              <div>
                                <label className="label mb-1.5 block" htmlFor={`bl-notes-${d.id}`}>
                                  Notes
                                </label>
                                <textarea
                                  id={`bl-notes-${d.id}`}
                                  className="input-field min-h-[60px] w-full text-sm font-body"
                                  value={inlineForm.notes}
                                  onChange={(e) => setInlineForm((f) => ({ ...f, notes: e.target.value }))}
                                  placeholder="Additional context…"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleBlacklistSubmit(d.id)}
                                  disabled={inlineSaving}
                                  className="btn-primary !bg-danger hover:!bg-danger-dark border-danger hover:border-danger-dark text-cream text-xs px-3 py-1.5"
                                >
                                  {inlineSaving ? 'Saving…' : 'Confirm Blacklist'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInlineBlacklistId(null)}
                                  disabled={inlineSaving}
                                  className="btn-ghost text-xs px-3 py-1.5"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
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
