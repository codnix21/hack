import { describe, expect, it } from 'vitest'
import { suggestNextStep } from './nextStep'
import {
  buildAttentionItems,
  classifyWarningText,
  resolveAttentionGoField,
} from './attention'
import {
  scenarioCompareColumnKeys,
  scenarioMetricDisplay,
} from '../components/project/scenarioCompare'

describe('suggestNextStep', () => {
  it('asks to fill params when object needs data', () => {
    const s = suggestNextStep({ object: 'needs_data' })
    expect(s.step).toBe('object')
    expect(s.ctaLabel).toMatch(/параметр/i)
  })

  it('suggests matching before layout when params ready', () => {
    const s = suggestNextStep({ object: 'done', layout: 'idle', selection: 'ready' })
    expect(s.step).toBe('selection')
    expect(s.ctaLabel).toMatch(/подбор/i)
  })

  it('suggests matching when params done and layout done', () => {
    const s = suggestNextStep({ object: 'done', layout: 'done', selection: 'ready' })
    expect(s.step).toBe('selection')
  })

  it('suggests economics after matching', () => {
    const s = suggestNextStep({
      object: 'done',
      layout: 'done',
      selection: 'done',
      economics: 'ready',
    })
    expect(s.step).toBe('economics')
    expect(s.ctaLabel).toMatch(/экономик/i)
  })

  it('suggests layout after economics when plan missing', () => {
    const s = suggestNextStep({
      object: 'done',
      layout: 'idle',
      selection: 'done',
      economics: 'done',
    })
    expect(s.step).toBe('layout')
  })

  it('suggests visualization then report when economics and layout done', () => {
    const s = suggestNextStep({
      object: 'done',
      layout: 'done',
      selection: 'done',
      economics: 'done',
      report: 'ready',
    })
    expect(s.step).toBe('visualization')
    const report = suggestNextStep({
      object: 'done',
      layout: 'done',
      selection: 'done',
      economics: 'done',
      visualization: 'done',
      report: 'ready',
    })
    expect(report.step).toBe('report')
  })
})

describe('attention', () => {
  it('separates missing as fix and estimate as assumption', () => {
    const items = buildAttentionItems({
      params: {
        peak_demand: 100,
        peak_demand_is_estimate: true,
      },
    })
    expect(items.some((i) => i.category === 'fix')).toBe(true)
    expect(items.some((i) => i.category === 'assumption' && /нагрузк/i.test(i.title))).toBe(true)
  })

  it('classifies model assumption wording', () => {
    expect(classifyWarningText('Это допущение модели, не гарантия')).toBe('assumption')
    expect(classifyWarningText('Отсутствует обязательный параметр')).toBe('fix')
  })

  it('resolves goField for import warnings and assumptions', () => {
    expect(resolveAttentionGoField('peak_demand_flag')).toBe('peak_demand')
    expect(
      resolveAttentionGoField(
        'warn_current_labor',
        'current_labor_cost_year рассчитан из численности',
      ),
    ).toBe('current_labor_cost_year')
    const items = buildAttentionItems({
      params: {
        peak_demand: 100,
        peak_demand_is_estimate: true,
        current_labor_cost_year: 1e6,
        _import_warnings: [
          'peak_demand оценён из суточного объёма отбора = 6818.18 оп/ч',
        ],
      },
    })
    expect(items.some((i) => i.goField === 'peak_demand')).toBe(true)
    const labor = buildAttentionItems({
      params: {
        peak_demand: 100,
        current_labor_cost_year: 1e6,
        _import_warnings: [
          'current_labor_cost_year рассчитан из численности: staff_count × з/п_мес × 12 × коэф_ФОТ → 281,232,000 ₽/год.',
        ],
      },
    })
    const laborItem = labor.find((i) => i.goField === 'current_labor_cost_year')
    expect(laborItem).toBeTruthy()
    expect(laborItem!.impact).not.toMatch(/current_labor_cost_year|staff_count/)
    expect(laborItem!.impact).toMatch(/годовые затраты на персонал|численность/i)
    expect(laborItem!.impact.endsWith('…')).toBe(false)
  })
})

describe('scenarioCompareColumnKeys', () => {
  it('defaults to five primary columns', () => {
    expect(scenarioCompareColumnKeys(false)).toEqual([
      'name',
      'capex',
      'effect',
      'payback',
      'npv',
    ])
  })

  it('expands extras when showAll', () => {
    const keys = scenarioCompareColumnKeys(true)
    expect(keys).toContain('opex')
    expect(keys).toContain('tco')
    expect(keys.length).toBeGreaterThan(5)
  })

  it('does not invent zero for missing metrics', () => {
    expect(scenarioMetricDisplay(null, (n) => String(n))).toBe('Нет данных')
    expect(scenarioMetricDisplay(undefined, (n) => String(n))).toBe('Нет данных')
    expect(scenarioMetricDisplay(0, (n) => String(n))).toBe('0')
  })
})
