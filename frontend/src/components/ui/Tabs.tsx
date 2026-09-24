import type { ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ items, value, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex flex-wrap gap-1 border-b border-steel-200 ${className}`}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active
                ? 'border-brand-600 text-ink'
                : 'border-transparent text-steel-500 hover:text-steel-800'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {item.icon}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
