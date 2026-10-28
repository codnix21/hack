import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface DisclosureProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function Disclosure({
  title,
  children,
  defaultOpen = false,
  className = '',
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={`group rounded-[var(--nc-radius-lg)] border border-[var(--nc-border)] bg-[var(--nc-surface)] ${className}`}
    >
      <button
        type="button"
        className="nc-focusable flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-[var(--nc-ink)]"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--nc-faint)] transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="border-t border-[var(--nc-border-subtle)] px-3 py-3 text-sm text-[var(--nc-text)]">
          {children}
        </div>
      ) : null}
    </div>
  )
}
