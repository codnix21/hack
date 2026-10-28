import type { HTMLAttributes, ReactNode } from 'react'
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react'

type Variant = 'info' | 'warning' | 'success' | 'danger'

const STYLES: Record<Variant, string> = {
  info: 'border-[var(--nc-border)] bg-[var(--nc-info-soft)] text-[var(--nc-text)]',
  warning: 'border-[rgba(245,185,66,0.35)] bg-[var(--nc-warning-soft)] text-[var(--nc-warning)]',
  success: 'border-[rgba(184,240,0,0.35)] bg-[var(--nc-lime-soft)] text-[var(--nc-lime)]',
  danger: 'border-[rgba(255,92,92,0.35)] bg-[var(--nc-danger-soft)] text-[var(--nc-danger)]',
}

const ICONS: Record<Variant, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  danger: XCircle,
}

interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  title?: string
  children: ReactNode
  className?: string
}

export function Callout({
  variant = 'info',
  title,
  children,
  className = '',
  ...rest
}: CalloutProps) {
  const Icon = ICONS[variant]
  return (
    <div
      className={`rounded-[var(--nc-radius-lg)] border px-3 py-2.5 text-sm ${STYLES[variant]} ${className}`}
      role="status"
      {...rest}
    >
      <div className="flex gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-90" aria-hidden />
        <div className="min-w-0 flex-1">
          {title && <p className="font-medium text-[var(--nc-ink)]">{title}</p>}
          <div className={title ? 'mt-1 text-[var(--nc-text)]' : ''}>{children}</div>
        </div>
      </div>
    </div>
  )
}
