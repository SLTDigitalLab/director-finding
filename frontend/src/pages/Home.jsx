import { useOutletContext } from 'react-router-dom'
import UploadZone from '../components/UploadZone'

export default function Home() {
  const { onUploadSuccess } = useOutletContext()

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8 sm:mb-10 animate-fade-in">
        <h2 className="section-title">Upload Form 1 PDF</h2>
        <div className="mt-3 h-0.5 w-14 bg-gold" aria-hidden />
        <p className="mt-4 max-w-3xl text-sm font-body leading-relaxed text-ink-500">
          Upload a completed Form 1 (Application for Registration of a Company). On large screens, use the
          left column for the file, then review the extraction in the right column. Click{' '}
          <span className="font-semibold text-ink-600">Extract</span>, then{' '}
          <span className="font-semibold text-ink-600">Save to registry</span> when you are ready.
        </p>
      </div>
      <UploadZone onSuccess={onUploadSuccess} />
    </div>
  )
}
