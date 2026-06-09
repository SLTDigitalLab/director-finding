import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  FileSearch,
  Sparkles,
  LayoutPanelLeft,
  ShieldAlert,
} from 'lucide-react'
import { extractPdf, saveExtraction } from '../api/client'

function BlacklistBanner({ directorCount, companyBlacklisted, companyReason }) {
  if (!directorCount && !companyBlacklisted) return null
  return (
    <div
      className="flex items-start gap-3 rounded-sm border border-danger/30 bg-danger-muted px-4 py-3 text-danger"
      role="alert"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-sm leading-relaxed font-body space-y-1">
        {directorCount > 0 && (
          <p>
            <strong>{directorCount}</strong> director{directorCount !== 1 ? 's' : ''} on this form match the supervisor
            blacklist (by NIC/passport).
          </p>
        )}
        {companyBlacklisted && (
          <p>
            <strong>This company is blacklisted.</strong>
            {companyReason ? ` ${companyReason}` : ''}
          </p>
        )}
        <p className="text-xs opacity-90">Review before saving.</p>
      </div>
    </div>
  )
}

function StepDot({ done, active, label }) {
  return (
    <div className="flex flex-1 items-center gap-2 min-w-0">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-mono font-semibold transition-colors duration-200
          ${done ? 'border-success bg-success-muted text-success' : ''}
          ${active && !done ? 'border-gold bg-gold/15 text-ink-800' : ''}
          ${!done && !active ? 'border-ink-200 bg-white text-ink-400' : ''}`}
      >
        {done ? <CheckCircle className="h-3.5 w-3.5" /> : active ? <Sparkles className="h-3.5 w-3.5 text-gold-dark" /> : '·'}
      </span>
      <span
        className={`hidden truncate text-[11px] font-mono uppercase tracking-wider sm:block
          ${active ? 'text-ink-700' : 'text-ink-400'}`}
      >
        {label}
      </span>
    </div>
  )
}

export default function UploadZone({ onSuccess }) {
  const [file, setFile] = useState(null)
  const [extractLoading, setExtractLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [extractResponse, setExtractResponse] = useState(null)
  const [saveResult, setSaveResult] = useState(null)
  const [error, setError] = useState('')

  const onDrop = useCallback((accepted) => {
    if (accepted.length === 0) return
    setFile(accepted[0])
    setExtractResponse(null)
    setSaveResult(null)
    setError('')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
  })

  const reset = () => {
    setFile(null)
    setExtractResponse(null)
    setSaveResult(null)
    setError('')
    setProgress(0)
    setExtractLoading(false)
    setSaveLoading(false)
  }

  const handleExtract = async () => {
    if (!file) return
    setExtractLoading(true)
    setProgress(0)
    setError('')
    setSaveResult(null)
    try {
      const res = await extractPdf(file, setProgress)
      setExtractResponse(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Extraction failed. Please try again.')
    } finally {
      setExtractLoading(false)
    }
  }

  const handleSave = async () => {
    if (!extractResponse?.extraction) return
    setSaveLoading(true)
    setError('')
    try {
      const res = await saveExtraction(extractResponse.extraction)
      setSaveResult(res.data)
      setExtractResponse(null)
      setFile(null)
      onSuccess && onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed. Please try again.')
    } finally {
      setSaveLoading(false)
    }
  }

  const preview = extractResponse?.preview
  const blacklistedCount = preview?.directors?.filter((d) => d.is_blacklisted).length ?? 0

  const hasFile = Boolean(file)
  const hasPreview = Boolean(preview && !saveResult)
  const isSaved = Boolean(saveResult)

  return (
    <div className="w-full animate-fade-in">
      <div className="card-elevated overflow-hidden">
        {!saveResult && (
          <div className="border-b border-ink-100 px-5 py-4 sm:px-8 sm:py-5">
            <div className="flex items-stretch gap-1">
              <StepDot done={hasFile} active={!hasFile} label="Upload" />
              <div
                className="mx-1 hidden h-px min-w-[12px] flex-1 self-center bg-ink-100 sm:block"
                aria-hidden
              />
              <StepDot
                done={isSaved}
                active={extractLoading || (hasPreview && !isSaved)}
                label="Review & save"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-ink-100">
          {/* LEFT — file & extract */}
          <section className="p-5 sm:p-8">
            <div className="mb-4 flex items-center gap-2 lg:mb-5">
              <LayoutPanelLeft className="h-4 w-4 text-gold-dark" aria-hidden />
              <h3 className="label mb-0">File &amp; extract</h3>
            </div>

            <div className="space-y-5">
              <div
                {...getRootProps()}
                className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed p-8 text-center transition-all duration-300 sm:p-10
                  ${
                    isDragActive
                      ? 'drop-zone-active scale-[1.01]'
                      : 'border-ink-200 bg-gradient-to-b from-white to-cream/30 hover:border-ink-300 hover:shadow-panel'
                  }
                  ${file ? 'border-ink-300 bg-white/90' : ''}
                `}
              >
                <input {...getInputProps()} />
                {file ? (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center bg-ink text-cream shadow-panel">
                      <FileText className="h-7 w-7 text-gold" />
                    </div>
                    <div>
                      <p className="font-body font-semibold text-ink">{file.name}</p>
                      <p className="label mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <p className="text-xs text-ink-400">Click or drop to replace file</p>
                  </>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center bg-parchment shadow-[inset_0_0_0_1px_rgba(15,17,23,0.06)]">
                      <Upload className="h-7 w-7 text-ink-400" />
                    </div>
                    <div>
                      <p className="font-body font-semibold text-ink">
                        {isDragActive ? 'Drop the PDF here' : 'Drag & drop a Form 1 PDF'}
                      </p>
                      <p className="mt-1 text-sm text-ink-400">or click to browse</p>
                    </div>
                    <span className="tag">PDF only</span>
                  </>
                )}
              </div>

              {file && !extractResponse && !saveResult && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleExtract}
                    disabled={extractLoading}
                    className="btn-primary gap-2"
                    type="button"
                  >
                    {extractLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Extracting… {progress > 0 && `${progress}%`}
                      </>
                    ) : (
                      <>
                        <FileSearch className="h-4 w-4" />
                        Extract
                      </>
                    )}
                  </button>
                  <button onClick={reset} className="btn-ghost gap-1.5" type="button">
                    <X className="h-3.5 w-3.5" /> Clear
                  </button>
                </div>
              )}

              {extractLoading && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light transition-all duration-300"
                    style={{ width: `${Math.max(progress, 8)}%` }}
                  />
                </div>
              )}

              <p className="text-xs leading-relaxed text-ink-400 lg:hidden">
                Scroll down to see the review, or use a wider screen to view it beside this column.
              </p>
            </div>
          </section>

          {/* RIGHT — review / result */}
          <aside
            className="flex min-h-[20rem] flex-col border-t border-ink-100 bg-gradient-to-b from-parchment/35 to-cream/25 p-5 sm:p-8 lg:min-h-[28rem] lg:border-t-0 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:sticky lg:top-8 lg:self-start"
            aria-label="Extraction review"
          >
            <div className="mb-4 flex items-center gap-2 lg:mb-5">
              <FileSearch className="h-4 w-4 text-gold-dark" aria-hidden />
              <h3 className="label mb-0">Review</h3>
            </div>

            {saveResult ? (
              <div className="space-y-4 rounded-sm border border-success/25 bg-success-muted/60 p-5">
                <div className="flex items-start gap-3 text-success">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-panel">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold text-success">Saved successfully</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{saveResult.message}</p>
                  </div>
                </div>
                <div className="border-t border-ink-100/80 pt-4">
                  <p className="label">Saved company</p>
                  <p className="font-display mt-2 text-lg font-semibold text-ink">{saveResult.company.name}</p>
                  <p className="mt-1 text-sm text-ink-500">{saveResult.company.company_type}</p>
                </div>
                <div className="border-t border-ink-100/80 pt-4">
                  <p className="label">Directors linked from this form ({saveResult.directors.length})</p>
                  <div className="mt-3 space-y-2">
                    {saveResult.directors.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-3 rounded-sm border border-ink-100 bg-white px-3 py-2"
                      >
                        <div className="flex h-7 w-7 items-center justify-center bg-ink font-mono text-xs text-cream">
                          {d.full_name[0]}
                        </div>
                        <div>
                          {d.nic_passport ? (
                            <span className="block font-mono text-xs text-ink-500">{d.nic_passport}</span>
                          ) : (
                            <span className="block font-mono text-xs text-ink-400 italic">No ID on file</span>
                          )}
                          <span className="font-body text-sm font-medium text-ink">{d.full_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={reset} className="btn-ghost text-xs" type="button">
                  Upload another
                </button>
              </div>
            ) : preview && !saveResult ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`tag text-[10px] ${
                        preview.company_exists_in_registry ? 'border-gold/50 bg-gold/10' : ''
                      }`}
                    >
                      {preview.company_exists_in_registry ? 'Already in registry' : 'New company'}
                    </span>
                    <p className="text-xs leading-snug text-ink-500 font-body">{preview.message}</p>
                  </div>
                  <BlacklistBanner
                    directorCount={blacklistedCount}
                    companyBlacklisted={preview.company_is_blacklisted}
                    companyReason={preview.company_blacklist_reason}
                  />
                </div>

                <div
                  className={
                    preview.company_is_blacklisted
                      ? 'rounded-sm border border-danger/30 bg-danger-muted/40 px-3 py-2'
                      : ''
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-semibold leading-snug text-ink sm:text-lg">
                      {preview.company_name}
                    </p>
                    {preview.company_is_blacklisted && (
                      <span className="inline-flex items-center gap-1 rounded-sm border border-danger/40 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-danger">
                        <ShieldAlert className="h-3 w-3" />
                        Blacklisted company
                      </span>
                    )}
                  </div>
                  {preview.company_type && (
                    <p className="mt-0.5 text-sm text-ink-500">{preview.company_type}</p>
                  )}
                  {preview.registered_address && (
                    <p className="mt-2 text-xs leading-relaxed text-ink-500 font-body">
                      {preview.registered_address}
                    </p>
                  )}
                </div>

                <div>
                  <p className="label">Directors from this PDF</p>
                  <p className="mt-1 text-xs text-ink-400 font-body">
                    Directors are matched by <strong>NIC or passport</strong> when available, or by{' '}
                    <strong>full name + email</strong> as a fallback. IDs can be added to a director's record later.
                  </p>

                  <div className="table-shell mt-3 overflow-x-auto">
                    <table className="w-full min-w-[20rem] border-collapse text-left">
                      <caption className="sr-only">
                        Directors from the uploaded PDF and other companies each person is linked to in the database
                      </caption>
                      <thead>
                        <tr className="border-b border-ink-200 bg-parchment/80">
                          <th
                            scope="col"
                            className="w-8 px-3 py-2.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-500"
                          >
                            #
                          </th>
                          <th
                            scope="col"
                            className="min-w-[11rem] px-3 py-2.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-500"
                          >
                            NIC / name (from PDF)
                          </th>
                          <th
                            scope="col"
                            className="min-w-[12rem] px-3 py-2.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-500"
                          >
                            <span className="block">Other companies</span>
                            <span className="mt-0.5 block font-normal normal-case tracking-normal text-ink-400">
                              from your database
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 bg-white">
                        {preview.directors.map((d, i) => {
                          const others = d.other_companies ?? []
                          const knownInDb = d.id != null
                          return (
                            <tr
                              key={`${d.nic_passport || d.full_name}-${i}`}
                              className={`align-top ${d.is_blacklisted ? 'bg-danger-muted/40' : ''}`}
                            >
                              <td className="px-3 py-3 font-mono text-xs text-ink-400">{i + 1}</td>
                              <td className="min-w-0 px-3 py-3">
                                <p className="font-mono text-sm font-semibold text-ink-800">
                                  {d.nic_passport || (
                                    <span className="text-ink-400 font-normal">No ID on form</span>
                                  )}
                                </p>
                                <p className="mt-1 font-body text-sm leading-snug text-ink">{d.full_name}</p>
                                {d.missing_nic && d.matched_by === 'name_email' && (
                                  <p className="mt-1 text-xs text-gold-dark">
                                    Matched by name + email — no ID on this form. ID can be added later.
                                  </p>
                                )}
                                {d.missing_nic && d.matched_by === 'none' && (
                                  <p className="mt-1 text-xs text-ink-500">
                                    No ID and no name + email match — will be saved as a new director.
                                  </p>
                                )}
                                {d.name_changed && d.registry_full_name && (
                                  <p className="mt-1 text-xs text-gold-dark">
                                    Name on file: <span className="font-semibold">{d.registry_full_name}</span> — PDF shows
                                    a different name (same ID).
                                  </p>
                                )}
                                {d.is_blacklisted && (
                                  <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger">
                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                    Blacklisted
                                    {d.blacklist_company_name ? ` (${d.blacklist_company_name})` : ''}
                                    {d.blacklist_reason ? ` — ${d.blacklist_reason}` : ''}
                                  </p>
                                )}
                                {(d.id_type || d.id_country) && (
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-ink-400">
                                    {d.id_type && <span className="tag !px-2 !py-0.5">{d.id_type}</span>}
                                    {d.id_country && <span className="tag !px-2 !py-0.5">{d.id_country}</span>}
                                  </div>
                                )}
                              </td>
                              <td className="min-w-0 px-3 py-3">
                                {others.length > 0 ? (
                                  <ul className="space-y-1.5">
                                    {others.map((co) => (
                                      <li key={co.id}>
                                        <span className="text-sm font-medium text-ink font-body">{co.name}</span>
                                        {co.company_type && (
                                          <span className="ml-1.5 text-xs text-ink-400">({co.company_type})</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                ) : knownInDb ? (
                                  <span className="text-xs text-ink-400">None — only this company in your registry.</span>
                                ) : (
                                  <span className="text-xs text-ink-400">
                                    Not in your registry yet — will be created on save.
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-ink-100/80 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saveLoading}
                    className="btn-primary gap-2"
                    type="button"
                  >
                    {saveLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Save to registry
                      </>
                    )}
                  </button>
                  <button onClick={reset} className="btn-ghost gap-1.5" type="button">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </div>
              </div>
            ) : extractLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-gold" />
                <div>
                  <p className="font-body text-sm font-semibold text-ink">Extracting…</p>
                  <p className="mt-1 text-xs text-ink-500">This can take a minute for large PDFs.</p>
                  {progress > 0 && <p className="mt-2 font-mono text-xs text-ink-400">{progress}% uploaded</p>}
                </div>
              </div>
            ) : error ? (
              <div
                className="flex items-start gap-3 rounded-sm border border-danger/25 bg-danger-muted p-4 text-danger"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-sm leading-relaxed">{error}</span>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-sm border border-dashed border-ink-200 bg-white/50 py-14 text-center px-4">
                <FileSearch className="mb-4 h-11 w-11 text-ink-200" />
                <p className="font-body text-sm font-semibold text-ink-600">Review will appear here</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-ink-400">
                  Choose a Form 1 PDF on the left, then click <strong className="text-ink-600">Extract</strong> to load the
                  company and directors table before saving.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
