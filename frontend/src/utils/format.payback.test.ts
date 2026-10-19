import { describe, expect, it } from 'vitest'
import { formatBreakdownValue, formatPayback } from './format'

describe('formatPayback / formatBreakdownValue', () => {
  it('shows months for sub-year payback instead of 0.0 years', () => {
    expect(formatPayback({ payback_years: 0.007, payback_display: 'менее 1 месяца' })).toBe(
      'менее 1 месяца',
    )
    expect(formatPayback({ payback_years: 0.25 })).toMatch(/мес/)
  })

  it('explains beyond-horizon payback with simple estimate', () => {
    expect(
      formatPayback({
        payback_years: null,
        simple_payback_years: 8.2,
        horizon_years: 5,
        message: 'На горизонте 5 лет…',
      }),
    ).toMatch(/> 5 лет.*8[,.]2/)
  })

  it('formats ops_staff_count as headcount not currency', () => {
    expect(formatBreakdownValue('ops_staff_count', 1)).toBe('1 чел.')
    expect(formatBreakdownValue('ops_staff', 900_000)).toContain('₽')
  })
})
