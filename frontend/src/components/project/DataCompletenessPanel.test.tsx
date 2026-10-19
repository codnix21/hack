import { describe, expect, it } from 'vitest'
import { buildCompleteness } from './DataCompletenessPanel'

describe('buildCompleteness', () => {
  it('marks critical missing fields', () => {
    const items = buildCompleteness({})
    const missing = items.filter((i) => i.kind === 'missing')
    expect(missing.some((i) => i.key === 'peak_demand')).toBe(true)
    expect(missing.some((i) => i.key === 'current_labor_cost_year')).toBe(true)
  })

  it('flags peak estimate as assumption', () => {
    const items = buildCompleteness({
      peak_demand: 6818,
      peak_demand_is_estimate: true,
      current_labor_cost_year: 48_000_000,
      unit_price: 3_500_000,
      staff_count: 40,
      area_m2: 12000,
      area_width_m: 80,
      required_payload_kg: 1000,
    })
    expect(items.some((i) => i.key === 'peak_demand' && i.kind === 'assumption')).toBe(true)
    expect(items.filter((i) => i.kind === 'missing')).toHaveLength(0)
  })
})
