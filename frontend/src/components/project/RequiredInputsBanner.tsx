import type { CapabilityReadiness, ChecklistItem } from '../../utils/requiredInputs'
import { localizeUserFacingWarning } from '../../utils/labels'
import { Button } from '../ui/Button'

interface Props {
  economics: CapabilityReadiness
  capabilities?: {
    matching_ready?: boolean
    layout_ready?: boolean
    des_ready?: boolean
    report_ready?: boolean
  }
  onGoField?: (field: string) => void
  onGoEconomics?: () => void
  className?: string
}

export function RequiredInputsBanner({
  economics,
  capabilities,
  onGoField,
  onGoEconomics,
  className = '',
}: Props) {
  const { filled_required, total_required, checklist, errors, ready } = economics
  const remaining = Math.max(0, total_required - filled_required)
  const missing = checklist.filter((c) => !c.filled)

  return (
    <div
      className={`nc-panel border-l-4 px-3 py-2.5 ${
        ready ? 'border-l-emerald-600' : 'border-l-amber-500'
      } ${className}`}
      data-testid="required-inputs-banner"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            Минимальные данные: {filled_required} из {total_required}
          </p>
          <p className="mt-0.5 text-xs text-steel-600">
            {ready
              ? 'Базовый расчёт экономики доступен. Дополнительные поля необязательны.'
              : `Заполните ещё ${remaining} ${remaining === 1 ? 'поле' : 'поля'} для расчёта экономики.`}
          </p>
        </div>
        {ready && onGoEconomics ? (
          <Button size="sm" onClick={onGoEconomics}>
            К экономике
          </Button>
        ) : null}
      </div>

      <ul className="mt-2 flex flex-wrap gap-1.5">
        {checklist.map((c) => (
          <li key={c.field}>
            <button
              type="button"
              className={`nc-focusable rounded border px-2 py-0.5 text-xs ${
                c.filled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-950'
              }`}
              title={localizeUserFacingWarning(c.reason)}
              onClick={() => onGoField?.(c.field)}
            >
              {c.filled ? '✓' : '!'} {c.label}
              {!c.filled && c.category === 'required'
                ? ' · обязательно'
                : !c.filled && c.category === 'conditional'
                  ? ' · условно'
                  : ''}
            </button>
          </li>
        ))}
      </ul>

      {!ready && missing.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-950">
          {missing.map((c: ChecklistItem) => (
            <li key={`m-${c.field}`}>
              <button
                type="button"
                className="font-medium text-brand-800 hover:underline"
                onClick={() => onGoField?.(c.field)}
              >
                {c.label}
              </button>
              <span className="text-steel-600">
                {' '}
                — {localizeUserFacingWarning(c.reason)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {capabilities && (
        <p className="mt-2 text-[11px] text-steel-500">
          Доступно:{' '}
          {[
            ready ? 'экономика' : null,
            capabilities.matching_ready !== false ? 'подбор' : null,
            capabilities.layout_ready ? 'планировка' : null,
            capabilities.des_ready ? 'DES' : null,
            capabilities.report_ready ? 'отчёт' : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'только просмотр параметров'}
        </p>
      )}

      {errors.length > 0 && (
        <p className="sr-only" role="status">
          {errors.map((e) => e.message).join('; ')}
        </p>
      )}
    </div>
  )
}
