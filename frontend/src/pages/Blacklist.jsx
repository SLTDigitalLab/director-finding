import BlacklistPanel from '../components/BlacklistPanel'

export default function Blacklist() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="section-title">Blacklist Database</h2>
        <div className="mt-3 h-0.5 w-14 bg-gold" aria-hidden />
        <p className="text-sm text-ink-500 mt-4 font-body max-w-2xl leading-relaxed">
          Audit blacklisted companies and directors. Manual blacklists must be removed by supervisor
          intervention; auto-blacklisted companies are managed by their associated director records.
        </p>
      </div>
      <BlacklistPanel />
    </div>
  )
}

