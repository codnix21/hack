/** Статус актуальности экономики относительно текущих входов. */
export type EconomicsFreshnessStatus = 'none' | 'fresh' | 'stale'

export const ECONOMICS_FRESHNESS_LABEL: Record<EconomicsFreshnessStatus, string> = {
  none: 'Не рассчитано',
  fresh: 'Актуально',
  stale: 'Требуется пересчёт',
}

export interface EconomicsFreshnessResponse {
  status: EconomicsFreshnessStatus
  last_calc_at?: string | null
  mismatches?: string[]
}

/**
 * Клиентская корректировка: несохранённые параметры всегда требуют пересчёта,
 * даже если сервер ещё считает сохранённый расчёт свежим.
 */
export function resolveEconomicsFreshness(
  server: EconomicsFreshnessStatus | undefined | null,
  opts: { paramsDirty?: boolean; hasStoredResult?: boolean },
): EconomicsFreshnessStatus {
  if (opts.paramsDirty && (opts.hasStoredResult || server === 'fresh' || server === 'stale')) {
    return 'stale'
  }
  if (server === 'fresh' || server === 'stale' || server === 'none') return server
  return opts.hasStoredResult ? 'stale' : 'none'
}
