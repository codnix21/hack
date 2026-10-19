/** Ключи колонок сравнения сценариев (UI без расчётов). */

export const SCENARIO_PRIMARY_COLUMNS = [
  'name',
  'capex',
  'effect',
  'payback',
  'npv',
] as const

export const SCENARIO_EXTRA_COLUMNS = [
  'robots',
  'opex',
  'raas',
  'roi',
  'tco',
  'outlay',
  'coverage',
] as const

export function scenarioCompareColumnKeys(showAll: boolean): string[] {
  if (showAll) {
    return [...SCENARIO_PRIMARY_COLUMNS, ...SCENARIO_EXTRA_COLUMNS]
  }
  return [...SCENARIO_PRIMARY_COLUMNS]
}

/** Отображение метрики: null/undefined → «Нет данных», 0 остаётся 0. */
export function scenarioMetricDisplay(
  value: number | null | undefined,
  format: (n: number) => string,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Нет данных'
  return format(value)
}
