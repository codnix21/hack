/** Единый блок «Что требует внимания»: категории без смешивания. */

import type { ProjectParams } from '../types'
import { buildCompleteness, type CompletenessItem } from '../components/project/DataCompletenessPanel'
import { localizeUserFacingWarning, objectParamLabel } from './labels'

export type AttentionCategory = 'fix' | 'review' | 'assumption'

export interface AttentionItem {
  id: string
  category: AttentionCategory
  title: string
  impact: string
  /** step id для перехода, если известен */
  goStep?: string
  /** ключ параметра объекта для scroll/focus на форме */
  goField?: string
}

/** Сопоставить ключ completeness / текст предупреждения с полем формы. */
export function resolveAttentionGoField(key: string, detail = ''): string | undefined {
  if (key === 'peak_demand' || key === 'peak_demand_flag') return 'peak_demand'
  if (key === 'current_labor_cost_year') return 'current_labor_cost_year'
  if (
    key === 'staff_count' ||
    key === 'area_m2' ||
    key === 'area_width_m' ||
    key === 'aisle_width_mm' ||
    key === 'required_payload_kg'
  ) {
    return key
  }
  const blob = `${key} ${detail}`.toLowerCase()
  if (
    blob.includes('peak_demand') ||
    blob.includes('пиковая нагрузка') ||
    (blob.includes('пик') && blob.includes('оцен'))
  ) {
    return 'peak_demand'
  }
  if (
    blob.includes('current_labor_cost_year') ||
    blob.includes('годовые затраты на персонал') ||
    blob.includes('численност') ||
    (blob.includes('labor') && blob.includes('рассчитан'))
  ) {
    return 'current_labor_cost_year'
  }
  return undefined
}

export function paramFieldDomId(fieldKey: string): string {
  return `param-field-${fieldKey}`
}

/** Краткий заголовок + полный текст без обрезки и без EN-ключей. */
export function presentWarningText(raw: string): { title: string; impact: string; goField?: string } {
  const impact = localizeUserFacingWarning(raw).trim()
  const goField = resolveAttentionGoField('', raw)
  const low = impact.toLowerCase()
  let title = 'Предупреждение'
  if (low.includes('цен') && (low.includes('каталог') || low.includes('допущен') || low.includes('capex'))) {
    title = 'Цена из допущения модели'
  } else if (low.includes('пиков') || low.includes('пиковую нагрузку') || low.includes('пиковый спрос')) {
    title = 'Оценка пиковой нагрузки'
  } else if (low.includes('персонал') || low.includes('труд') || low.includes('численност')) {
    title = 'Оценка затрат на персонал'
  } else if (low.includes('паллет') && low.includes('строк')) {
    title = 'Разные единицы объёма'
  } else if (low.includes('конфликт')) {
    title = 'Конфликт источников данных'
  }
  return { title, impact, goField }
}

const CATEGORY_ORDER: AttentionCategory[] = ['fix', 'review', 'assumption']

function completenessToAttention(item: CompletenessItem): AttentionItem | null {
  if (item.kind === 'filled') return null
  const goField = resolveAttentionGoField(item.key, item.detail)
  if (item.kind === 'missing') {
    const critical =
      item.key === 'peak_demand' ||
      item.key === 'current_labor_cost_year' ||
      item.key === 'unit_price'
    return {
      id: `c:${item.key}`,
      category: 'fix',
      title: critical
        ? `Обязательное поле не заполнено: ${item.label}`
        : `${item.label}: нет значения`,
      impact: localizeUserFacingWarning(item.detail),
      goStep: 'object',
      goField,
    }
  }
  if (item.kind === 'review') {
    // Импортные предупреждения: не дублировать «Предупреждение импорта» + сырой EN
    if (item.key.startsWith('warn_') || item.label === 'Предупреждение импорта') {
      const presented = presentWarningText(item.detail)
      return {
        id: `c:${item.key}`,
        category: 'review',
        title: presented.title,
        impact: presented.impact,
        goStep: 'object',
        goField: presented.goField || goField,
      }
    }
    return {
      id: `c:${item.key}`,
      category: 'review',
      title: item.label,
      impact: localizeUserFacingWarning(item.detail),
      goStep: 'object',
      goField,
    }
  }
  return {
    id: `c:${item.key}`,
    category: 'assumption',
    title: item.label,
    impact: localizeUserFacingWarning(item.detail),
    goStep: 'object',
    goField,
  }
}

/** Классификация текста предупреждения экономики/импорта. */
export function classifyWarningText(text: string): AttentionCategory {
  const t = text.toLowerCase()
  if (
    t.includes('отсутств') ||
    t.includes('не задан') ||
    t.includes('обязатель') ||
    t.includes('недостаточно') ||
    t.includes('ошибк')
  ) {
    return 'fix'
  }
  if (
    t.includes('допущен') ||
    t.includes('оценк') ||
    t.includes('оценен') ||
    t.includes('оценён') ||
    t.includes('по умолчанию') ||
    t.includes('модель') ||
    t.includes('не гарант') ||
    t.includes('не норматив')
  ) {
    return 'assumption'
  }
  return 'review'
}

export function buildAttentionItems(opts: {
  params: ProjectParams
  /** предупреждения расчёта экономики (уже могут включать импорт) */
  economicsWarnings?: string[] | null
  missingChecksCount?: number
}): AttentionItem[] {
  const { params, economicsWarnings, missingChecksCount } = opts
  const seen = new Set<string>()
  const out: AttentionItem[] = []

  const push = (item: AttentionItem) => {
    const key = `${item.category}|${item.title}|${item.impact}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(item)
  }

  for (const c of buildCompleteness(params)) {
    const a = completenessToAttention(c)
    if (a) push(a)
  }

  const knownImpacts = new Set(out.map((i) => i.impact.toLowerCase()))
  for (const w of economicsWarnings || []) {
    if (!w || typeof w !== 'string') continue
    const presented = presentWarningText(w)
    if (knownImpacts.has(presented.impact.toLowerCase())) continue
    if (Array.isArray(params._import_warnings) && params._import_warnings.includes(w)) {
      const already = out.some((i) => i.impact.includes(presented.impact.slice(0, 48)))
      if (already) continue
    }
    // Не дублировать assumption peak, уже есть из completeness
    if (
      presented.goField === 'peak_demand' &&
      out.some((i) => i.goField === 'peak_demand' && i.category === 'assumption')
    ) {
      continue
    }
    push({
      id: `e:${presented.title}:${presented.impact.slice(0, 64)}`,
      category: classifyWarningText(w),
      title: presented.title,
      impact: presented.impact,
      goStep: presented.goField ? 'object' : 'economics',
      goField: presented.goField,
    })
    knownImpacts.add(presented.impact.toLowerCase())
  }

  if (missingChecksCount && missingChecksCount > 0) {
    push({
      id: 'match:missing_checks',
      category: 'review',
      title: 'У части решений нет подтверждённых характеристик',
      impact: `Проверьте ${missingChecksCount} позиций с недостающими ТТХ в каталоге`,
      goStep: 'selection',
    })
  }

  out.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  )
  return out
}

export const ATTENTION_CATEGORY_LABELS: Record<AttentionCategory, string> = {
  fix: 'Нужно исправить',
  review: 'Нужно проверить',
  assumption: 'Допущение модели',
}

/** Краткая подпись для поля в импорте (без утечки ключа). */
export function importMappedParamHint(fieldKey: string | undefined | null): string | null {
  if (!fieldKey || fieldKey === 'ignore') return null
  return objectParamLabel(fieldKey)
}
