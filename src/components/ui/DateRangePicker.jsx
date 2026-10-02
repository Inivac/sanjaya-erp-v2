import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

export default function DateRangePicker({ value, onChange, className }) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempRange, setTempRange] = useState(value || { startDate: '', endDate: '' })
  const pickerRef = useRef(null)

  useEffect(() => {
    setTempRange(value || { startDate: '', endDate: '' })
  }, [value])

  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleApply() {
    onChange(tempRange)
    setIsOpen(false)
  }

  function handleCancel() {
    setTempRange(value || { startDate: '', endDate: '' })
    setIsOpen(false)
  }

  function formatDateDisplay(date) {
    if (!date) return 'Select date'
    const d = new Date(date)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const displayValue = tempRange.startDate && tempRange.endDate
    ? `${formatDateDisplay(tempRange.startDate)} - ${formatDateDisplay(tempRange.endDate)}`
    : tempRange.startDate
    ? formatDateDisplay(tempRange.startDate)
    : 'Select date range'

  return (
    <div ref={pickerRef} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink',
          'hover:border-brass focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none',
          'w-64'
        )}
      >
        <Calendar size={16} className="text-muted" />
        <span className={clsx(!tempRange.startDate && 'text-muted')}>
          {displayValue}
        </span>
        <ChevronDown size={14} className="ml-auto text-muted" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-line bg-white shadow-pop p-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Start Date
              </label>
              <input
                type="date"
                value={tempRange.startDate}
                onChange={e => setTempRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-brass focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                End Date
              </label>
              <input
                type="date"
                value={tempRange.endDate}
                onChange={e => setTempRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-brass focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 rounded-lg bg-brass px-3 py-2 text-sm text-white hover:bg-brass-dark"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
