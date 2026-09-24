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
        <div className="flex items-start justify-between gap-3 border-b border-steel-200 bg-steel-50/60 px-5 py-3.5">
          <div>
            {title && (
              <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                {title}
              </h3>
            )}
            {subtitle && <p className="mt-0.5 text-sm text-steel-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={padding ? 'p-5' : ''}>{children}</div>
    </div>
  )
}
