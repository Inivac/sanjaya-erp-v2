import clsx from 'clsx'

export function Card({ children, className, ticket = false, ...rest }) {
  return (
    <div
      className={clsx(
        'rounded-card border border-line bg-surface shadow-card',
        ticket && 'ticket-edge overflow-hidden',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function Button({ children, variant = 'primary', size = 'md', className, icon: Icon, ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  }
  const variants = {
    primary: 'bg-ink text-white hover:bg-ink-light shadow-sm',
    brass: 'bg-brass text-white hover:bg-brass-dark shadow-sm',
    outline: 'border border-line bg-white text-ink hover:bg-paper',
    ghost: 'text-ink hover:bg-ink/5',
    danger: 'bg-burgundy text-white hover:bg-burgundy-light',
    subtle: 'bg-paper text-ink hover:bg-line/60 border border-line',
  }
  return (
    <button className={clsx(base, sizes[size], variants[variant], className)} {...rest}>
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </button>
  )
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line pb-5 mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-brass-dark">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, children, hint, required, className }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}{required && <span className="text-burgundy"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brass focus:ring-1 focus:ring-brass'

export function Input({ className, ...props }) {
  return <input className={clsx(inputClass, className)} {...props} />
}

export function Select({ children, ...props }) {
  return <select className={inputClass} {...props}>{children}</select>
}

export function Textarea(props) {
  return <textarea className={clsx(inputClass, 'min-h-[90px] resize-y')} {...props} />
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      {Icon && <div className="rounded-full bg-paper p-3"><Icon size={22} className="text-brass-dark" /></div>}
      <div>
        <p className="font-display text-lg font-medium text-ink">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={clsx('relative z-10 w-full animate-in rounded-card bg-white shadow-pop', width, 'max-h-[88vh] overflow-y-auto scrollbar-thin')}>
        <div className="ticket-edge sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-6 py-4">
          <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-paper hover:text-ink">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
