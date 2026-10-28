import { describe, expect, it } from 'vitest'
import { shouldAutoBootstrapEconomics } from './economicsBootstrap'

describe('shouldAutoBootstrapEconomics', () => {
  it('never auto-calcs when stale', () => {
    expect(
      shouldAutoBootstrapEconomics({
        paramsReady: true,
        paramsDirty: false,
        freshnessStatus: 'stale',
        freshnessLoaded: true,
        hasLocalResult: true,
      }),
    ).toBe(false)
  })

  it('never auto-calcs when params dirty', () => {
    expect(
      shouldAutoBootstrapEconomics({
        paramsReady: true,
        paramsDirty: true,
        freshnessStatus: 'none',
        freshnessLoaded: true,
        hasLocalResult: false,
      }),
    ).toBe(false)
  })

  it('bootstraps none and fresh-without-local', () => {
    expect(
      shouldAutoBootstrapEconomics({
        paramsReady: true,
        paramsDirty: false,
        freshnessStatus: 'none',
        freshnessLoaded: true,
        hasLocalResult: false,
      }),
    ).toBe(true)
    expect(
      shouldAutoBootstrapEconomics({
        paramsReady: true,
        paramsDirty: false,
        freshnessStatus: 'fresh',
        freshnessLoaded: true,
        hasLocalResult: false,
      }),
    ).toBe(true)
    expect(
      shouldAutoBootstrapEconomics({
        paramsReady: true,
        paramsDirty: false,
        freshnessStatus: 'fresh',
        freshnessLoaded: true,
        hasLocalResult: true,
      }),
    ).toBe(false)
  })
})
