import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: Crumb[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Навигация"
      className="mb-3 flex flex-wrap items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-[var(--nc-muted)]"
    >
      {items.map((item, idx) => {
        const last = idx === items.length - 1
        return (
          <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-[var(--nc-faint)]" />}
            {item.to && !last ? (
              <Link to={item.to} className="text-[var(--nc-text)] hover:text-[var(--nc-link)]">
                {item.label}
              </Link>
            ) : (
              <span className={last ? 'font-medium text-[var(--nc-ink)]' : 'text-[var(--nc-text)]'}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
