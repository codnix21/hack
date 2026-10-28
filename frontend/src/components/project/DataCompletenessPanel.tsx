import type { ProjectParams } from '../../types'
import { localizeUserFacingWarning, objectParamLabel } from '../../utils/labels'
import { Callout } from '../ui/Callout'
import { Button } from '../ui/Button'

export type CompletenessKind = 'filled' | 'missing' | 'assumption' | 'review'

export interface CompletenessItem {
  key: string
  label: string
  kind: CompletenessKind
  detail: string
}

/** Поля для обзора полноты (не все блокируют экономику — см. requiredInputs). */
const CRITICAL_KEYS = [
  'peak_demand',
  'current_labor_cost_year',
  'unit_price',
  'staff_count',
  'area_m2',
  'area_width_m',
  'required_payload_kg',
]

const ASSUMPTION_HINTS: Record<string, string> = {
  peak_demand_is_estimate: 'Пиковая нагрузка оценена из суточного объёма — не измерение на объекте',
  labor_reduction_share: 'Ожидаемая доля сокращения трудозатрат — сценарное допущение модели',
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))
}

export function buildCompleteness(params: ProjectParams): CompletenessItem[] {
  const items: CompletenessItem[] = []
  const keys = Object.keys(params || {}).filter((k) => !k.startsWith('_') || k === '_import_warnings')

  for (const key of CRITICAL_KEYS) {
    const label = objectParamLabel(key)
    if (isEmpty(params[key])) {
      items.push({
        key,
        label,
        kind: 'missing',
        detail:
          key === 'peak_demand'
            ? 'Обязательное поле для расчёта экономики.'
            : key === 'current_labor_cost_year'
              ? 'Обязательное поле: укажите годовые затраты или численность со ставкой.'
              : key === 'unit_price'
                ? 'Условно обязательное поле: цена из каталога или вручную.'
                : key === 'area_m2' || key === 'area_width_m'
                  ? 'Нужно для планировки и DES; экономику не блокирует.'
                  : 'Улучшает подбор; базовый расчёт экономики не блокирует.',
      })
    } else {
      let detail = 'Задано пользователем или импортом'
      let kind: CompletenessKind = 'filled'
      if (key === 'peak_demand' && params.peak_demand_is_estimate) {
        kind = 'assumption'
        detail = ASSUMPTION_HINTS.peak_demand_is_estimate
      }
      if (key === 'current_labor_cost_year' && params._import_warnings) {
        const w = Array.isArray(params._import_warnings)
          ? params._import_warnings.join(' ')
          : String(params._import_warnings)
        if (/допущение|рассчитан из численности/i.test(w)) {
          kind = 'assumption'
          detail = 'Рассчитано из численности и зарплаты — проверьте размерность ₽/год'
        }
      }
      items.push({ key, label, kind, detail })
    }
  }

  if (params.peak_demand_is_estimate && !items.some((i) => i.key === 'peak_demand' && i.kind === 'assumption')) {
    items.push({
      key: 'peak_demand_flag',
      label: 'Пиковая нагрузка',
      kind: 'assumption',
      detail: ASSUMPTION_HINTS.peak_demand_is_estimate,
    })
  }

  const warnings = params._import_warnings
  if (Array.isArray(warnings)) {
    for (const w of warnings.slice(0, 5)) {
      if (typeof w !== 'string') continue
      items.push({
        key: `warn_${w.slice(0, 24)}`,
        label: 'Предупреждение импорта',
        kind: 'review',
        detail: localizeUserFacingWarning(w),
      })
    }
  }

  // area from dimensions
  if (isEmpty(params.area_m2) && !isEmpty(params.area_width_m) && !isEmpty(params.area_length_m)) {
    items.push({
      key: 'area_derived',
      label: 'Площадь',
      kind: 'filled',
      detail: 'Можно оценить из ширины × длины площадки',
    })
  }

  void keys
  return items
}

const KIND_RU: Record<CompletenessKind, string> = {
  filled: 'Заполнено',
  missing: 'Отсутствует',
  assumption: 'Допущение / оценка',
  review: 'Требует проверки',
}

interface DataCompletenessPanelProps {
  params: ProjectParams
  onContinueToMatching?: () => void
  onFocusImport?: () => void
  /** Если true — не дублировать предупреждения (их показывает AttentionPanel). */
  hideAttention?: boolean
}

export function DataCompletenessPanel({
  params,
  onContinueToMatching,
  onFocusImport,
  hideAttention = false,
}: DataCompletenessPanelProps) {
  const items = buildCompleteness(params)
  const missing = items.filter((i) => i.kind === 'missing').length
  const assumptions = items.filter((i) => i.kind === 'assumption').length
  const review = items.filter((i) => i.kind === 'review').length
  const filled = items.filter((i) => i.kind === 'filled').length

  const canProceed = missing < CRITICAL_KEYS.length

  // Компактный режим рядом с RequiredInputsBanner — без второго «баннера готовности»
  if (hideAttention) {
    return (
      <details className="nc-panel group px-3 py-2" data-testid="data-completeness-compact">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-[var(--nc-ink)]">Сводка полей объекта</span>
          <span className="text-xs text-[var(--nc-muted)]">
            заполнено {filled} · нет данных {missing} · допущений {assumptions}
            {review > 0 ? ` · проверка ${review}` : ''}
          </span>
        </summary>
        <div className="mt-2 space-y-2 border-t border-[var(--nc-border-subtle)] pt-2">
          <p className="text-xs text-[var(--nc-muted)]">
            Отсутствующие значения не подставляются. Минимальный набор для экономики — в блоке выше.
          </p>
          <ul className="divide-y divide-[var(--nc-border-subtle)]">
            {items.map((item) => (
              <li
                key={item.key}
                className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--nc-ink)]">{item.label}</p>
                  <p className="text-xs text-[var(--nc-muted)]">{item.detail}</p>
                </div>
                <span className="mt-0.5 shrink-0 text-xs font-medium text-[var(--nc-muted)] sm:mt-0">
                  {KIND_RU[item.kind]}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            {onFocusImport && (
              <Button type="button" size="sm" variant="outline" onClick={onFocusImport}>
                Загрузить Excel
              </Button>
            )}
            {onContinueToMatching && (
              <Button
                type="button"
                size="sm"
                onClick={onContinueToMatching}
                disabled={!canProceed && filled === 0}
              >
                {missing > 0 ? 'К подбору с предупреждениями' : 'К подбору'}
              </Button>
            )}
          </div>
        </div>
      </details>
    )
  }

  return (
    <div className="nc-panel space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="nc-title-sm text-base">Проверка исходных данных</h3>
          <p className="nc-body mt-1">
            Перед подбором убедитесь, что критичные поля заполнены. Отсутствующие значения не
            выдумываются.
          </p>
        </div>
        <dl className="flex flex-wrap gap-4 text-xs text-[var(--nc-muted)]">
          <div>
            <dt className="text-[var(--nc-lime)]">Заполнено</dt>
            <dd className="text-lg font-semibold tabular-nums text-[var(--nc-ink)]">{filled}</dd>
          </div>
          <div>
            <dt className="text-red-700">Нет данных</dt>
            <dd className="text-lg font-semibold tabular-nums text-[var(--nc-ink)]">{missing}</dd>
          </div>
          <div>
            <dt className="text-[var(--nc-warning)]">Допущения</dt>
            <dd className="text-lg font-semibold tabular-nums text-[var(--nc-ink)]">{assumptions}</dd>
          </div>
          <div>
            <dt>Проверка</dt>
            <dd className="text-lg font-semibold tabular-nums text-[var(--nc-ink)]">{review}</dd>
          </div>
        </dl>
      </div>

      {!hideAttention && missing > 0 && (
        <Callout variant="warning" title="Не хватает данных для уверенного расчёта">
          Заполните поля вручную или загрузите Excel. Можно продолжить, но рейтинг и экономика будут
          с большими допущениями.
        </Callout>
      )}
      {!hideAttention && assumptions > 0 && missing === 0 && (
        <Callout variant="info" title="Есть оценки и допущения">
          Они явно помечены ниже и в отчёте. Измените их, если у вас есть точные данные объекта.
        </Callout>
      )}

      {!hideAttention && (
        <details className="rounded border border-[var(--nc-border-subtle)]" open={missing > 0 || assumptions > 0}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[var(--nc-ink)]">
            Подробности по полям ({items.length})
          </summary>
          <ul className="divide-y divide-[var(--nc-border-subtle)] border-t border-[var(--nc-border-subtle)]">
            {items.map((item) => (
              <li
                key={item.key}
                className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--nc-ink)]">{item.label}</p>
                  <p className="text-xs text-[var(--nc-muted)]">{item.detail}</p>
                </div>
                <span
                  className={`mt-1 shrink-0 text-xs font-medium sm:mt-0 ${
                    item.kind === 'filled'
                      ? 'text-[var(--nc-lime)]'
                      : item.kind === 'missing'
                        ? 'text-red-700'
                        : 'text-[var(--nc-warning)]'
                  }`}
                >
                  {KIND_RU[item.kind]}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        {onFocusImport && (
          <Button type="button" variant="outline" onClick={onFocusImport}>
            Загрузить Excel
          </Button>
        )}
        {onContinueToMatching && (
          <Button type="button" onClick={onContinueToMatching} disabled={!canProceed && filled === 0}>
            {missing > 0 ? 'Перейти к подбору с предупреждениями' : 'Перейти к подбору'}
          </Button>
        )}
      </div>
    </div>
  )
}
