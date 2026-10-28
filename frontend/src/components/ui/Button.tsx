import { type ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'outlineOnDark'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-[var(--nc-inverse)] font-semibold hover:bg-brand-400 active:translate-y-px shadow-[0_0_0_1px_rgba(240,115,22,0.45)]',
  secondary:
    'bg-ink-raised text-[var(--nc-ink)] border border-[var(--nc-border-strong)] hover:bg-ink-mute active:translate-y-px',
  ghost: 'bg-transparent text-[var(--nc-text)] hover:bg-[var(--nc-surface-hover)] hover:text-[var(--nc-ink)]',
  danger: 'bg-[var(--nc-danger)] text-[var(--nc-ink)] font-semibold hover:brightness-110',
  outline:
    'border border-[var(--nc-border-strong)] bg-transparent text-[var(--nc-ink)] hover:border-brand-500/60 hover:bg-signal-soft',
  outlineOnDark:
    'border border-white/30 bg-transparent text-white hover:border-brand-400 hover:bg-[var(--nc-surface)]/5',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-5 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`nc-focusable inline-flex items-center justify-center gap-2 rounded-[var(--nc-radius)] font-medium transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
