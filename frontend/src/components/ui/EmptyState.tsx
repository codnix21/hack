import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { Button } from './Button'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--nc-radius)] border border-[var(--nc-border)] bg-[var(--nc-surface-muted)] text-[var(--nc-muted)]">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="nc-title-sm text-[var(--nc-ink)]">{title}</h3>
      {description ? <p className="nc-body mt-2 max-w-md">{description}</p> : null}
      {actionLabel && onAction && (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
