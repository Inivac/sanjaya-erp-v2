import clsx from 'clsx'

const STYLES = {
  neutral: 'bg-ink/5 text-ink border-ink/10',
  brass: 'bg-brass-50 text-brass-dark border-brass-light/60',
  sage: 'bg-sage-50 text-sage border-sage-light/50',
  burgundy: 'bg-burgundy-50 text-burgundy border-burgundy-light/40',
}

const STATUS_MAP = {
  'Available': 'sage',
  'In Use': 'brass',
  'Dry Clean': 'burgundy',
  'Damaged': 'burgundy',
  'Retired': 'neutral',
  'Pending': 'burgundy',
  'Confirmed': 'brass',
  'Ready': 'brass',
  'Returned': 'sage',
  'Overdue': 'burgundy',
  'Active': 'sage',
  'Invited': 'brass',
  'Suspended': 'burgundy',
}

export default function Badge({ children, tone, dot = true, className }) {
  const resolved = tone || STATUS_MAP[children] || 'neutral'
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide',
      STYLES[resolved], className
    )}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', {
        'bg-sage': resolved === 'sage',
        'bg-brass-dark': resolved === 'brass',
        'bg-burgundy': resolved === 'burgundy',
        'bg-ink/40': resolved === 'neutral',
      })} />}
      {children}
    </span>
  )
}
