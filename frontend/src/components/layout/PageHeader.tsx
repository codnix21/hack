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
    <header className="mb-3 sm:mb-4">
      {crumbs && crumbs.length > 0 && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-steel-200 pb-2.5 sm:gap-3 sm:pb-3">
        <div className="min-w-0 flex-1">
          <h1 className="nc-title break-words">{title}</h1>
          {subtitle ? (
            <p className="nc-body mt-0.5 max-w-3xl line-clamp-2" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  )
}
