import { describe, expect, it } from 'vitest'
import { resolveEconomicsFreshness } from './economicsFreshness'

describe('resolveEconomicsFreshness', () => {
  it('keeps server none without stored result', () => {
    expect(resolveEconomicsFreshness('none', {})).toBe('none')
  })

  it('marks stale when params are dirty and a result exists', () => {
    expect(
      resolveEconomicsFreshness('fresh', { paramsDirty: true, hasStoredResult: true }),
    ).toBe('stale')
  })

  it('does not claim fresh when server status is missing but CAPEX exists', () => {
    expect(resolveEconomicsFreshness(undefined, { hasStoredResult: true })).toBe('stale')
  })

  it('passes through fresh when params are clean', () => {
    expect(resolveEconomicsFreshness('fresh', { paramsDirty: false })).toBe('fresh')
  })
})
