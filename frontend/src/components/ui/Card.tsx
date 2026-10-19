import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  actions?: ReactNode
  padding?: boolean
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  padding = true,
  ...props
}: CardProps) {
  return (
    <div className={`page-surface ${className}`} {...props}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-2 border-b border-steel-100 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            {title ? <h3 className="nc-title-sm text-base">{title}</h3> : null}
            {subtitle ? <p className="nc-body mt-0.5 text-xs">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      )}
      <div className={padding ? 'p-3 sm:p-4' : ''}>{children}</div>
    </div>
  )
}
