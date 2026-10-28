interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-[var(--nc-surface-hover)] ${className}`} />
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="nc-panel flex flex-col gap-2.5 px-3.5 py-3">
          <div className="flex items-start gap-2">
            <Skeleton className="h-4 min-w-0 flex-1" />
            <Skeleton className="h-5 w-12 shrink-0" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-14 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}
