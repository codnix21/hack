import type { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const styles: Record<BadgeVariant, string> = {
  default: 'border-[var(--nc-border)] bg-[var(--nc-surface-muted)] text-[var(--nc-text)]',
  success: 'border-[rgba(198,242,58,0.4)] bg-[var(--nc-lime-soft)] text-[var(--nc-lime)]',
  warning: 'border-[rgba(245,193,74,0.4)] bg-[var(--nc-warning-soft)] text-[var(--nc-warning)]',
  danger: 'border-[rgba(255,107,107,0.4)] bg-[var(--nc-danger-soft)] text-[var(--nc-danger)]',
  info: 'border-[rgba(122,175,255,0.4)] bg-[var(--nc-info-soft)] text-[var(--nc-info)]',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded border px-1.5 py-0.5 text-[11px] font-medium ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
