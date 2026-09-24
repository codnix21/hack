import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || props.name
    return (
      <label className="block space-y-1.5">
        {label && (
          <span className="text-sm font-medium text-steel-700">{label}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-10 w-full rounded border bg-white px-3 text-sm text-steel-900 placeholder:text-steel-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40 disabled:bg-steel-50 ${
            error ? 'border-red-400' : 'border-steel-300'
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-red-600">{error}</span>}
        {!error && hint && <span className="text-xs text-steel-500">{hint}</span>}
      </label>
    )
  },
)
Input.displayName = 'Input'
