import { describe, expect, it } from 'vitest'
import {
  assessEconomicsLocal,
  fieldRequirement,
  hasLaborSource,
  hasPriceSource,
  parseInputsIncompleteDetail,
} from './requiredInputs'

describe('requiredInputs', () => {
  it('blocks economics when required fields empty', () => {
    const r = assessEconomicsLocal({})
    expect(r.ready).toBe(false)
    expect(r.filled_required).toBe(0)
    expect(r.total_required).toBe(3)
  })

  it('accepts minimal set without optional area', () => {
    const r = assessEconomicsLocal({
      peak_demand: 200,
      current_labor_cost_year: 12_000_000,
      unit_price: 3_500_000,
    })
    expect(r.ready).toBe(true)
  })

  it('accepts derived labor from staff + salary', () => {
    expect(
      hasLaborSource({
        staff_count: 40,
        staff_salary_month: 100_000,
      }),
    ).toBe(true)
    const r = assessEconomicsLocal({
      peak_demand: 100,
      staff_count: 40,
      staff_salary_month: 100_000,
      unit_price: 2_000_000,
    })
    expect(r.ready).toBe(true)
  })

  it('treats robot price as price source', () => {
    expect(hasPriceSource({}, { robotPrice: 4_500_000 })).toBe(true)
    expect(
      fieldRequirement('unit_price', {}, { robotPrice: 4_500_000 }).required,
    ).toBe(false)
  })

  it('parses inputs_incomplete detail', () => {
    const issues = parseInputsIncompleteDetail({
      code: 'inputs_incomplete',
      errors: [{ field: 'peak_demand', code: 'required', message: 'Укажите пик', severity: 'error' }],
    })
    expect(issues).toHaveLength(1)
    expect(issues[0].field).toBe('peak_demand')
  })
})
