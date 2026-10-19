/**
 * Клиентское зеркало backend/app/services/required_inputs.py
 * (обязательность для UX; сервер остаётся источником истины при расчёте).
 */

import type { ProjectParams } from '../types'

export type InputCategory = 'required' | 'conditional' | 'optional' | 'derived'
export type Capability = 'economics' | 'matching' | 'layout' | 'des' | 'report'

export interface InputIssue {
  field: string
  code: string
  message: string
  severity: 'error' | 'warning'
  category?: InputCategory
  capability?: Capability
}

export interface ChecklistItem {
  field: string
  label: string
  filled: boolean
  category: InputCategory
  reason: string
}

export interface CapabilityReadiness {
  capability: Capability
  ready: boolean
  errors: InputIssue[]
  warnings: InputIssue[]
  checklist: ChecklistItem[]
  filled_required: number
  total_required: number
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n
}

function present(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false
  if (Array.isArray(v) && v.length === 0) return false
  return true
}

export function peakValue(params: ProjectParams): number | null {
  if (present(params.peak_demand)) return num(params.peak_demand)
  return num(params.peak_ops_per_hour)
}

export function hasLaborSource(params: ProjectParams): boolean {
  const explicit = num(params.current_labor_cost_year)
  if (explicit != null && explicit > 0) return true
  const staffYear = num(params.staff_cost_year)
  if (staffYear != null && staffYear > 0) return true
  const n = num(params.staff_count)
  if (n != null && n > 0) {
    const perYear = num(params.staff_cost_per_person_year)
    if (perYear != null && perYear > 0) return true
    const month =
      num(params.staff_salary_month) ??
      num(params.picker_salary_month) ??
      num(params.avg_salary_month)
    if (month != null && month > 0) return true
  }
  return false
}

export function hasPriceSource(
  params: ProjectParams,
  opts?: { robotPrice?: number | null; hasSelectedRobot?: boolean },
): boolean {
  if (opts?.robotPrice != null && opts.robotPrice > 0) return true
  const up = num(params.unit_price)
  if (up != null && up > 0) return true
  const assumed = num(params.assumed_unit_price)
  if (assumed != null && assumed > 0) return true
  return false
}

export function hasArea(params: ProjectParams): boolean {
  const a = num(params.area_m2)
  if (a != null && a > 0) return true
  const w = num(params.area_width_m)
  const l = num(params.area_length_m)
  return w != null && l != null && w > 0 && l > 0
}

/** Минимальный набор для экономики (3 пункта checklist). */
export function economicsChecklist(
  params: ProjectParams,
  opts?: { robotPrice?: number | null },
): ChecklistItem[] {
  const peak = peakValue(params)
  return [
    {
      field: 'peak_demand',
      label: 'Пиковая нагрузка',
      filled: peak != null && peak > 0,
      category: 'required',
      reason: 'Число роботов и CAPEX',
    },
    {
      field: 'current_labor_cost_year',
      label: 'Затраты на персонал',
      filled: hasLaborSource(params),
      category: 'conditional',
      reason: 'Годовой эффект и окупаемость (явные или из численности)',
    },
    {
      field: 'unit_price',
      label: 'Цена решения',
      filled: hasPriceSource(params, opts),
      category: 'conditional',
      reason: 'CAPEX: каталог / unit_price / assumed_unit_price',
    },
  ]
}

export function assessEconomicsLocal(
  params: ProjectParams,
  opts?: { robotPrice?: number | null; hasSelectedRobot?: boolean },
): CapabilityReadiness {
  const checklist = economicsChecklist(params, opts)
  const errors: InputIssue[] = []
  for (const c of checklist) {
    if (!c.filled) {
      errors.push({
        field: c.field,
        code: 'required',
        message:
          c.field === 'peak_demand'
            ? 'Укажите пиковую нагрузку (оп/ч)'
            : c.field === 'current_labor_cost_year'
              ? 'Укажите годовые затраты на персонал или численность со ставкой'
              : 'Выберите решение с ценой или укажите unit_price / assumed_unit_price',
        severity: 'error',
        category: c.category,
        capability: 'economics',
      })
    }
  }
  const peak = peakValue(params)
  if (peak != null && peak <= 0) {
    errors.push({
      field: 'peak_demand',
      code: 'out_of_range',
      message: 'Пиковая нагрузка должна быть больше нуля',
      severity: 'error',
      capability: 'economics',
    })
  }
  return {
    capability: 'economics',
    ready: errors.length === 0,
    errors,
    warnings: [],
    checklist,
    filled_required: checklist.filter((c) => c.filled).length,
    total_required: checklist.length,
  }
}

/** Поля минимального режима заполнения. */
export const COMPACT_FIELD_KEYS = [
  'peak_demand',
  'current_labor_cost_year',
  'staff_count',
  'staff_salary_month',
  'unit_price',
  'assumed_unit_price',
  'required_payload_kg',
  'area_m2',
  'area_width_m',
  'area_length_m',
] as const

export function fieldRequirement(
  key: string,
  params: ProjectParams,
  opts?: { robotPrice?: number | null },
): { required: boolean; category: InputCategory; reason?: string } {
  if (key === 'peak_demand' || key === 'peak_ops_per_hour') {
    return {
      required: true,
      category: 'required',
      reason: 'Нужна для расчёта числа роботов и CAPEX',
    }
  }
  if (key === 'current_labor_cost_year') {
    const laborOk = hasLaborSource(params)
    // условно: не required если уже есть производный путь через staff
    const needExplicit = !laborOk
    return {
      required: needExplicit,
      category: 'conditional',
      reason: needExplicit
        ? 'Или заполните численность и ставку — иначе экономика недоступна'
        : 'Можно оставить пустым, если задана численность со ставкой',
    }
  }
  if (key === 'staff_count' || key === 'staff_salary_month' || key === 'staff_cost_per_person_year') {
    const explicit = num(params.current_labor_cost_year)
    const need = !(explicit != null && explicit > 0) && !hasLaborSource(params)
    return {
      required: need && key === 'staff_count',
      category: 'derived',
      reason: 'Альтернатива прямому current_labor_cost_year',
    }
  }
  if (key === 'unit_price' || key === 'assumed_unit_price') {
    return {
      required: !hasPriceSource(params, opts),
      category: 'conditional',
      reason: 'Нужна, если в каталоге не выбрано решение с ценой',
    }
  }
  if (key === 'area_m2' || key === 'area_width_m' || key === 'area_length_m') {
    return {
      required: !hasArea(params) && (key === 'area_m2' || key === 'area_width_m'),
      category: 'conditional',
      reason: 'Для планировки и DES: площадь или ширина×длина',
    }
  }
  if (key === 'required_payload_kg' || key === 'aisle_width_mm') {
    return {
      required: false,
      category: 'optional',
      reason: 'Улучшает подбор, не блокирует экономику',
    }
  }
  return { required: false, category: 'optional' }
}

export function parseInputsIncompleteDetail(detail: unknown): InputIssue[] {
  if (!detail || typeof detail !== 'object') return []
  const d = detail as { code?: string; errors?: InputIssue[]; detail?: unknown }
  if (d.code === 'inputs_incomplete' && Array.isArray(d.errors)) return d.errors
  // axios may nest
  if (d.detail && typeof d.detail === 'object') {
    return parseInputsIncompleteDetail(d.detail)
  }
  return []
}
