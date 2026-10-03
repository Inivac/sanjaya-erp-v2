import { useState, useEffect, useRef } from 'react'
import { X, Search } from 'lucide-react'
import clsx from 'clsx'
import { inputClass } from './Primitives.jsx'

export default function Autocomplete({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Search...', 
  displayKey = 'name',
  required = false,
  loading = false,
  onSearch,
  debounceMs = 300,
  disabled = false,
  isDisabled = null, // function(option) => boolean — marks individual options as non-selectable (shows "Booked")
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onSearch && searchTerm !== value) {
        onSearch(searchTerm)
      }
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [searchTerm, debounceMs, onSearch, value])

  // Update search term when value changes externally
  useEffect(() => {
    if (value) {
      const selected = options.find(opt => getOptionValue(opt) === value)
      if (selected) {
        setSearchTerm(getOptionDisplay(selected))
      }
    }
  }, [value, options])

  function getOptionDisplay(option) {
    if (typeof option === 'string') return option
    if (typeof displayKey === 'function') return displayKey(option)
    return option[displayKey] || ''
  }

  function getOptionValue(option) {
    if (typeof option === 'string') return option
    return String(option.id || option.value || '')
  }

  function isOptionDisabled(option) {
    return typeof isDisabled === 'function' ? isDisabled(option) : false
  }

  function handleSelect(option) {
    if (isOptionDisabled(option)) return // block selecting booked items
    const val = getOptionValue(option)
    onChange(val)
    setSearchTerm(getOptionDisplay(option))
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  function handleClear() {
    onChange('')
    setSearchTerm('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  function filterOptions() {
    if (!searchTerm) return options.slice(0, 50)
    const term = searchTerm.toLowerCase()
    return options.filter(opt => {
      const display = getOptionDisplay(opt).toLowerCase()
      return display.includes(term)
    }).slice(0, 50)
  }

  const filteredOptions = filterOptions()
  const hasSelectableOptions = filteredOptions.some(o => !isOptionDisabled(o))

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={e => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={clsx(inputClass, 'pr-20', disabled && 'opacity-50 cursor-not-allowed bg-paper')}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brass border-t-transparent" />
          )}
          {searchTerm && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-muted hover:bg-paper hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
          <Search size={14} className="text-muted" />
        </div>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-line bg-white shadow-pop"
        >
          {filteredOptions.map((option, index) => {
            const optDisabled = isOptionDisabled(option)
            return (
              <li
                key={getOptionValue(option)}
                onClick={() => handleSelect(option)}
                className={clsx(
                  'flex items-center justify-between px-3 py-2 text-sm',
                  optDisabled
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer text-ink hover:bg-paper',
                  !optDisabled && highlightedIndex === index && 'bg-brass/10 text-ink',
                  !optDisabled && getOptionValue(option) === value && 'font-medium text-brass-dark',
                )}
              >
                <span className={clsx('truncate', optDisabled && 'line-through text-muted')}>
                  {getOptionDisplay(option)}
                </span>
                {optDisabled && (
                  <span className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold bg-burgundy/10 text-burgundy">
                    Booked
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {isOpen && searchTerm && filteredOptions.length === 0 && !loading && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
          No results found
        </div>
      )}

      {isOpen && searchTerm && filteredOptions.length > 0 && !hasSelectableOptions && !loading && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
          All matching items are booked for these dates
        </div>
      )}
    </div>
  )
}
