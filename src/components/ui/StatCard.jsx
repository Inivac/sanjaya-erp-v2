import clsx from 'clsx'
import { Card } from './Primitives.jsx'

export default function StatCard({ label, value, delta, deltaTone = 'sage', icon: Icon, accent = 'brass' }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className={clsx('absolute right-0 top-0 h-16 w-16 rounded-bl-full opacity-10', {
        'bg-brass': accent === 'brass',
        'bg-burgundy': accent === 'burgundy',
        'bg-sage': accent === 'sage',
        'bg-ink': accent === 'ink',
      })} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">{value}</p>
        </div>
        {Icon && (
          <div className={clsx('rounded-lg p-2', {
            'bg-brass-50 text-brass-dark': accent === 'brass',
            'bg-burgundy-50 text-burgundy': accent === 'burgundy',
            'bg-sage-50 text-sage': accent === 'sage',
            'bg-ink/5 text-ink': accent === 'ink',
          })}>
            <Icon size={18} />
          </div>
        )}
      </div>
      {delta && (
        <p className={clsx('mt-3 text-xs font-medium', deltaTone === 'sage' ? 'text-sage' : 'text-burgundy')}>
          {delta}
        </p>
      )}
    </Card>
  )
}
