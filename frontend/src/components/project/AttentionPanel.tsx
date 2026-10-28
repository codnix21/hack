import { useState } from 'react'
import {
  ATTENTION_CATEGORY_LABELS,
  type AttentionCategory,
  type AttentionItem,
} from '../../utils/attention'
import { Button } from '../ui/Button'

interface AttentionPanelProps {
  items: AttentionItem[]
  /** Предпочтительно: шаг + поле для scroll/focus */
  onGoFix?: (item: AttentionItem) => void
  /** @deprecated используйте onGoFix */
  onGoStep?: (step: string) => void
  /** Свернуть подробности по умолчанию (когда рядом уже есть RequiredInputsBanner) */
  defaultCollapsed?: boolean
  className?: string
}

const CATEGORY_STYLE: Record<AttentionCategory, string> = {
  fix: 'border-[rgba(255,107,107,0.45)] bg-[var(--nc-danger-soft)] text-[var(--nc-danger)]',
  review: 'border-[rgba(245,193,74,0.4)] bg-[var(--nc-warning-soft)] text-[var(--nc-warning)]',
  assumption: 'border-[var(--nc-border)] bg-[var(--nc-surface-muted)] text-[var(--nc-text)]',
}

export function AttentionPanel({
  items,
  onGoFix,
  onGoStep,
  defaultCollapsed = false,
  className = '',
}: AttentionPanelProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed)

  if (items.length === 0) {
    return null
  }

  const groups = (['fix', 'review', 'assumption'] as AttentionCategory[])
    .map((cat) => ({ cat, rows: items.filter((i) => i.category === cat) }))
    .filter((g) => g.rows.length > 0)

  const criticalCount = items.filter((i) => i.category === 'fix' || i.category === 'review').length
  const summaryParts = groups.map((g) => `${ATTENTION_CATEGORY_LABELS[g.cat]}: ${g.rows.length}`)

  return (
    <div className={`nc-panel p-3 sm:p-4 ${className}`} data-testid="attention-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="nc-title-sm text-base">Что требует внимания</h3>
          <p className="mt-0.5 text-sm leading-snug text-[var(--nc-text)]">
            {criticalCount > 0
              ? `${criticalCount} к проверке · ${summaryParts.join(' · ')}`
              : summaryParts.join(' · ')}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          data-testid="attention-toggle"
        >
          {expanded ? 'Свернуть' : 'Подробнее'}
        </Button>
      </div>

      {!expanded && (
        <ul className="mt-2 space-y-1">
          {items
            .filter((i) => i.category === 'fix' || i.category === 'review')
            .slice(0, 3)
            .map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 break-words font-medium text-[var(--nc-warning)]">{item.title}</span>
                {(onGoFix || item.goStep) && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 shrink-0 px-2 text-xs"
                    onClick={() => {
                      if (onGoFix) onGoFix(item)
                      else if (item.goStep && onGoStep) onGoStep(item.goStep)
                    }}
                  >
                    Исправить
                  </Button>
                )}
              </li>
            ))}
        </ul>
      )}

      <div className={`mt-3 space-y-2 ${expanded ? 'block' : 'hidden'}`}>
        <p className="text-xs text-[var(--nc-muted)]">
          Ошибки, проверки и допущения разделены. Допущение модели — не ошибка ввода.
        </p>
        {groups.map(({ cat, rows }) => (
          <div key={cat} className={`rounded border px-3 py-2 ${CATEGORY_STYLE[cat]}`}>
            <p className="text-xs font-semibold">
              {ATTENTION_CATEGORY_LABELS[cat]} · {rows.length}
            </p>
            <ul className="mt-1.5 space-y-2">
              {rows.map((item) => {
                const canGo = Boolean(onGoFix || (item.goStep && onGoStep))
                return (
                  <li key={item.id} className="text-sm">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs leading-relaxed text-[var(--nc-text)] whitespace-pre-wrap break-words">
                      {item.impact}
                    </p>
                    {canGo && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-1 h-7 px-2 text-xs"
                        onClick={() => {
                          if (onGoFix) onGoFix(item)
                          else if (item.goStep && onGoStep) onGoStep(item.goStep)
                        }}
                      >
                        Перейти к исправлению
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
