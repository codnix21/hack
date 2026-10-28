import { SkeletonRows } from './Skeleton'

interface LoadingStateProps {
  rows?: number
  label?: string
  className?: string
}

/** Единое состояние загрузки для списков и панелей. */
export function LoadingState({
  rows = 6,
  label = 'Загрузка…',
  className = '',
}: LoadingStateProps) {
  return (
    <div className={className} role="status" aria-live="polite" data-testid="loading-state">
      <p className="sr-only">{label}</p>
      <SkeletonRows rows={rows} />
    </div>
  )
}
