import { describe, expect, it } from 'vitest'

/** Условие баннера «экономика vs DES» — без автовыравнивания. */
function showEconSimMismatch(
  econRobots: number | null | undefined,
  simRobots: number | null | undefined,
): boolean {
  return econRobots != null && simRobots != null && econRobots !== simRobots
}

/** Условие баннера «в модели vs на схеме» (анимация). */
function showSchemeMismatch(
  activeRobots: number,
  visibleRobots: number,
  robotsCapped: boolean,
): boolean {
  return activeRobots !== visibleRobots || robotsCapped
}

describe('robots count mismatch UX gates', () => {
  it('shows econ vs sim only when both known and differ', () => {
    expect(showEconSimMismatch(12, 6)).toBe(true)
    expect(showEconSimMismatch(12, 12)).toBe(false)
    expect(showEconSimMismatch(null, 6)).toBe(false)
    expect(showEconSimMismatch(12, undefined)).toBe(false)
  })

  it('shows scheme mismatch when visible subset or capped', () => {
    expect(showSchemeMismatch(20, 6, true)).toBe(true)
    expect(showSchemeMismatch(6, 6, false)).toBe(false)
    expect(showSchemeMismatch(8, 6, false)).toBe(true)
  })
})
