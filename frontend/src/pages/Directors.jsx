import { Link, useOutletContext } from 'react-router-dom'
import { Upload } from 'lucide-react'
import DirectorsTable from '../components/DirectorsTable'

export default function Directors() {
  const { refreshKey } = useOutletContext()

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="section-title">Directors</h2>
          <div className="mt-3 h-0.5 w-14 bg-gold" aria-hidden />
          <p className="text-sm text-ink-500 mt-4 font-body max-w-xl leading-relaxed">
            All directors in one registry. Filter by blacklist status, add people manually, or edit details
            including blacklist status and linked company.
          </p>
        </div>
        <Link to="/" className="btn-primary shrink-0 gap-2 text-xs px-5 py-2.5 sm:text-sm">
          <Upload className="w-3.5 h-3.5" /> Add via PDF
        </Link>
      </div>
      <DirectorsTable refreshKey={refreshKey} />
    </div>
  )
}
