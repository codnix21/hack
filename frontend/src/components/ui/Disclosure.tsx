import type { ReactNode } from 'react'

interface DisclosureProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
  summaryClassName?: string
}

/** Progressive disclosure: детали по запросу. */
export function Disclosure({
  title,
  children,
  defaultOpen = false,
  className = '',
  summaryClassName = '',
}: DisclosureProps) {
  return (
    <details
      className={`group rounded border border-steel-200 bg-white ${className}`}
      open={defaultOpen || undefined}
    >
      <summary
        className={`cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-steel-800 marker:content-none [&::-webkit-details-marker]:hidden ${summaryClassName}`}
      >
        <span className="flex items-center justify-between gap-2">
          <span>{title}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-steel-400 group-open:hidden">
            Показать
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-steel-400 group-open:inline">
            Скрыть
          </span>
        </span>
      </summary>
      <div className="border-t border-steel-100 px-3 py-3 text-sm text-steel-700">{children}</div>
    </details>
  )
}
