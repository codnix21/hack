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
    <nav aria-label="Навигация" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-steel-500">
      {items.map((item, idx) => {
        const last = idx === items.length - 1
        return (
          <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            {item.to && !last ? (
              <Link to={item.to} className="hover:text-brand-700">
                {item.label}
              </Link>
            ) : (
              <span className={last ? 'font-medium text-steel-800' : ''}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
