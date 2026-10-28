import type { EconomicsFreshnessStatus } from './economicsFreshness'

/**
 * Политика авто-запуска расчёта при открытии EconomicsPanel.
 * Нельзя автоматически пересчитывать при stale — иначе UI скрывает устаревание.
 */
export function shouldAutoBootstrapEconomics(opts: {
  paramsReady: boolean
  paramsDirty: boolean
  freshnessStatus: EconomicsFreshnessStatus | undefined
  freshnessLoaded: boolean
  hasLocalResult: boolean
}): boolean {
  if (!opts.paramsReady || opts.paramsDirty) return false
  if (!opts.freshnessLoaded) return false
  const s = opts.freshnessStatus
  if (s === 'stale') return false
  if (s === 'none') return true
  // fresh: bootstrap only if UI ещё без результата (после reload)
  if (s === 'fresh') return !opts.hasLocalResult
  return false
}
