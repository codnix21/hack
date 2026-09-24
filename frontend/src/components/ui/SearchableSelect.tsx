import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

export interface SearchableOption {
  value: string | number
  label: string
}

interface SearchableSelectProps {
  label?: string
  placeholder?: string
  options: SearchableOption[]
  value: string | number
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  allowClear?: boolean
  className?: string
  searchPlaceholder?: string
  emptyText?: string
  'aria-label'?: string
}

export function SearchableSelect({
  label,
  placeholder = 'Выберите…',
  options,
  value,
  onChange,
  error,
  disabled,
  allowClear = true,
  className = '',
  searchPlaceholder = 'Поиск…',
  emptyText = 'Ничего не найдено',
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const valueStr = value === undefined || value === null ? '' : String(value)

  const selected = useMemo(
    () => options.find((o) => String(o.value) === valueStr),
    [options, valueStr],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    const t = window.setTimeout(() => searchRef.current?.focus(), 0)
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('mousedown', onDoc)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[activeIndex]
      if (opt) pick(String(opt.value))
    }
  }

  return (
    <div ref={rootRef} className={`relative block space-y-1.5 ${className}`}>
      {label && <span className="text-sm font-medium text-steel-700">{label}</span>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel || label || placeholder}
          aria-invalid={!!error}
          className={`flex h-10 w-full items-center justify-between gap-2 rounded border bg-white px-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-steel-50 ${
            error ? 'border-red-400' : open ? 'border-brand-500' : 'border-steel-300'
          } ${selected ? 'text-steel-900' : 'text-steel-400'}`}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={onKeyDown}
        >
          <span className="min-w-0 truncate">{selected?.label || placeholder}</span>
          <span className="flex shrink-0 items-center gap-0.5">
            {allowClear && valueStr !== '' && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                className="rounded p-0.5 text-steel-400 hover:bg-steel-100 hover:text-steel-700"
                aria-label="Очистить"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <ChevronDown className={`h-4 w-4 text-steel-400 transition ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {open && (
          <div
            className="absolute z-40 mt-1 w-full overflow-hidden rounded border border-steel-200 bg-white shadow-lift"
            role="presentation"
          >
            <div className="border-b border-steel-100 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-400" />
                <input
                  ref={searchRef}
                  type="search"
                  className="h-9 w-full rounded border border-steel-200 bg-steel-50 pl-8 pr-2 text-sm text-steel-900 placeholder:text-steel-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  aria-label={searchPlaceholder}
                />
              </div>
            </div>
            <ul
              id={listId}
              role="listbox"
              className="max-h-56 overflow-auto py-1"
              aria-label={label || placeholder}
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-steel-500">{emptyText}</li>
              ) : (
                filtered.map((opt, i) => {
                  const selectedOpt = String(opt.value) === valueStr
                  const active = i === activeIndex
                  return (
                    <li key={String(opt.value)} role="option" aria-selected={selectedOpt}>
                      <button
                        type="button"
                        className={`flex w-full px-3 py-2 text-left text-sm transition ${
                          selectedOpt
                            ? 'bg-brand-50 font-medium text-brand-900'
                            : active
                              ? 'bg-steel-50 text-steel-900'
                              : 'text-steel-800 hover:bg-steel-50'
                        }`}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => pick(String(opt.value))}
                      >
                        {opt.label}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        )}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
