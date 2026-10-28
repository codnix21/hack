import type { ReactNode } from 'react'
import { AlertTriangle, Check, Circle, Clock, Info } from 'lucide-react'

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'idle'

const TONE: Record<
  StatusTone,
  { className: string; icon: typeof Circle }
> = {
  idle: {
    className: 'border-[var(--nc-border)] bg-[var(--nc-surface-muted)] text-[var(--nc-muted)]',
    icon: Circle,
  },
  neutral: {
    className: 'border-[var(--nc-border)] bg-[var(--nc-surface-raised)] text-[var(--nc-text)]',
    icon: Circle,
  },
  info: {
    className: 'border-[rgba(91,157,255,0.35)] bg-[var(--nc-info-soft)] text-[var(--nc-info)]',
    icon: Info,
  },
  success: {
    className: 'border-[rgba(184,240,0,0.35)] bg-[var(--nc-lime-soft)] text-[var(--nc-lime)]',
    icon: Check,
  },
  warning: {
    className: 'border-[rgba(245,185,66,0.35)] bg-[var(--nc-warning-soft)] text-[var(--nc-warning)]',
    icon: AlertTriangle,
  },
  danger: {
    className: 'border-[rgba(255,92,92,0.35)] bg-[var(--nc-danger-soft)] text-[var(--nc-danger)]',
    icon: AlertTriangle,
  },
}

interface StatusPillProps {
  tone?: StatusTone
  children: ReactNode
  className?: string
  withIcon?: boolean
  title?: string
}

export function StatusPill({
  tone = 'neutral',
  children,
  className = '',
  withIcon = true,
  title,
}: StatusPillProps) {
  const cfg = TONE[tone]
  const Icon = tone === 'idle' ? Clock : cfg.icon
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 rounded-[var(--nc-radius)] border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider leading-tight ${cfg.className} ${className}`}
    >
      {withIcon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
      <span className="truncate normal-case tracking-normal">{children}</span>
    </span>
  )
}
