import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Button } from '../components/ui/Primitives.jsx'

const ConfirmContext = createContext(null)

/**
 * ConfirmProvider renders one global confirmation dialog and exposes a
 * promise-based `confirm()` function via useConfirm(), so any component
 * can do:
 *   const confirm = useConfirm()
 *   const ok = await confirm({ title, message, tone: 'danger' })
 *   if (ok) { ...proceed... }
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null) // { title, message, confirmLabel, cancelLabel, tone }
  const resolver = useRef(null)

  const confirm = useCallback((options) => {
    setState({
      title: options.title || 'Are you sure?',
      message: options.message || 'This action cannot be undone.',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      tone: options.tone || 'danger', // 'danger' | 'default'
    })
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function handle(result) {
    setState(null)
    if (resolver.current) {
      resolver.current(result)
      resolver.current = null
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={() => handle(false)} />
          <div className="relative z-10 w-full max-w-sm animate-in rounded-card bg-white p-6 shadow-pop">
            <div className="flex items-start gap-3">
              <div className={`rounded-full p-2 ${state.tone === 'danger' ? 'bg-burgundy-50 text-burgundy' : 'bg-brass-50 text-brass-dark'}`}>
                {state.tone === 'danger' ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
              </div>
              <div className="flex-1">
                <h3 className="font-display text-base font-semibold text-ink">{state.title}</h3>
                <p className="mt-1 text-sm text-muted">{state.message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => handle(false)}>{state.cancelLabel}</Button>
              <Button variant={state.tone === 'danger' ? 'danger' : 'brass'} size="sm" onClick={() => handle(true)}>{state.confirmLabel}</Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
