import { forwardRef, type SelectHTMLAttributes } from 'react'

interface Option {
  value: string | number
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: Option[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', ...props }, ref) => (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-steel-700">{label}</span>}
      <select
        ref={ref}
        className={`h-10 w-full rounded border bg-white px-3 text-sm text-steel-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40 disabled:bg-steel-50 ${
          error ? 'border-red-400' : 'border-steel-300'
        } ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  ),
)
Select.displayName = 'Select'
