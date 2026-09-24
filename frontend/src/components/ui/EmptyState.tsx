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
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded border border-steel-200 bg-steel-50 text-steel-500">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-steel-500">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
