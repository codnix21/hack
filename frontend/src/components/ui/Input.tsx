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
          <span className="text-sm font-medium text-[var(--nc-ink)]">{label}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`nc-control nc-focusable w-full border bg-[var(--nc-surface-input)] px-3 text-sm text-[var(--nc-ink)] placeholder:text-[var(--nc-muted)] focus:border-brand-500 focus:outline-none disabled:opacity-55 ${
            error ? 'border-[var(--nc-danger)]' : 'border-[var(--nc-border)]'
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-[var(--nc-danger)]">{error}</span>}
        {!error && hint && <span className="text-xs text-[var(--nc-muted)]">{hint}</span>}
      </label>
    )
  },
)
Input.displayName = 'Input'
