import { type ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:translate-y-px',
  secondary: 'bg-ink text-white hover:bg-ink-soft active:translate-y-px',
  ghost: 'bg-transparent text-steel-700 hover:bg-steel-100',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  outline:
    'border border-steel-300 bg-white text-steel-800 hover:border-steel-400 hover:bg-steel-50',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-10 px-4 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`nc-focusable inline-flex items-center justify-center gap-2 rounded font-medium transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
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
