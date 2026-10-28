import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ErrorStateProps {
  title?: string
  description?: string
  /** Безопасный повтор (только GET / refetch без побочных эффектов) */
  onRetry?: () => void
  retryLabel?: string
  icon?: ReactNode
  className?: string
}

/**
 * Ошибка загрузки / запроса.
 * Retry только для идемпотентных операций (refetch списка, проекта и т.п.).
 */
export function ErrorState({
  title = 'Не удалось загрузить данные',
  description,
  onRetry,
  retryLabel = 'Повторить',
  icon,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}
      role="alert"
      data-testid="error-state"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--nc-radius)] border border-[rgba(255,92,92,0.35)] bg-[var(--nc-danger-soft)] text-[var(--nc-danger)]">
        {icon ?? <AlertTriangle className="h-6 w-6" />}
      </div>
      <h3 className="nc-title-sm text-[var(--nc-ink)]">{title}</h3>
      {description ? (
        <p className="nc-body mt-2 max-w-md break-words">{description}</p>
      ) : null}
      {onRetry ? (
        <Button className="mt-5" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
