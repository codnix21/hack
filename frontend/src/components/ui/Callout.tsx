import type { HTMLAttributes, ReactNode } from 'react'
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react'

type Variant = 'info' | 'warning' | 'success' | 'danger'

const STYLES: Record<Variant, string> = {
  info: 'border-steel-200 bg-steel-50 text-steel-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  danger: 'border-red-300 bg-red-50 text-red-950',
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
      className={`rounded border px-3 py-2.5 text-sm ${STYLES[variant]} ${className}`}
      role="status"
      {...rest}
    >
      <div className="flex gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <div className="min-w-0 flex-1">
          {title && <p className="font-medium">{title}</p>}
          <div className={title ? 'mt-1' : ''}>{children}</div>
        </div>
      </div>
    </div>
  )
}
