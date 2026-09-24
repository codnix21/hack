import type { ReactNode } from 'react'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: string
  crumbs?: Crumb[]
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, crumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {crumbs && crumbs.length > 0 && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-steel-200 pb-4">
        <div>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-ink">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 max-w-3xl text-sm text-steel-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
