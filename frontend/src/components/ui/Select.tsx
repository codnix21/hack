import { forwardRef, type SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string | number; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id || props.name || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)
    return (
      <label className="block space-y-1.5" htmlFor={selectId}>
        {label && <span className="text-sm font-medium text-[var(--nc-ink)]">{label}</span>}
        <select
          ref={ref}
          id={selectId}
          className={`nc-control nc-focusable w-full border bg-[var(--nc-surface-muted)] px-3 text-sm text-[var(--nc-ink)] focus:border-brand-500 focus:outline-none disabled:opacity-50 ${
            error ? 'border-[var(--nc-danger)]' : 'border-[var(--nc-border)]'
          } ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-[var(--nc-danger)]">{error}</span>}
      </label>
    )
  },
)
Select.displayName = 'Select'
