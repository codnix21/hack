import type { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const styles: Record<BadgeVariant, string> = {
  default: 'border-steel-300 bg-steel-50 text-steel-700',
  success: 'border-emerald-700/30 bg-emerald-50 text-emerald-900',
  warning: 'border-brand-600/35 bg-brand-50 text-brand-900',
  danger: 'border-red-700/30 bg-red-50 text-red-800',
  info: 'border-steel-400/40 bg-white text-steel-800',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
