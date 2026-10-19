import { describe, expect, it } from 'vitest'
import {
  ASSUMPTION_LABELS,
  KNOWN_USER_FACING_KEYS,
  MATCH_STATUS_LABELS,
  METRIC_LABELS,
  OBJECT_PARAM_LABELS,
  assumptionLabel,
  auditActionLabel,
  breakdownLabel,
  catalogStatsLabel,
  catalogTypeLabel,
  confirmationLevelLabel,
  dataOriginLabel,
  formatAuditDetails,
  formatAuditEntity,
  formulaLabel,
  isMissingDataWarning,
  matchStatusIcon,
  matchStatusLabel,
  metricLabel,
  missingCheckLabel,
  objectParamLabel,
  projectStatusLabel,
  unknownFieldLabel,
  valueSourceLabel,
  workModeLabel,
} from './labels'

describe('labels', () => {
  it('localizes confirmation levels', () => {
    expect(confirmationLevelLabel('confirmed')).toBe('Подтверждено')
    expect(confirmationLevelLabel('needs_review')).toBe('Требует проверки')
    expect(confirmationLevelLabel('assumption')).toBe('Допущение')
  })

  it('localizes data origin badges', () => {
    expect(dataOriginLabel('source')).toBe('Исходные материалы')
    expect(dataOriginLabel('demo')).toBe('Демонстрационные данные')
    expect(dataOriginLabel(undefined)).toBe('Демонстрационные данные')
  })

  it('localizes match statuses', () => {
    expect(matchStatusLabel('suitable')).toBe('Предварительно подходит')
    expect(matchStatusLabel('needs_review')).toBe('Требует проверки')
    expect(matchStatusLabel('excluded')).toBe('Не подходит')
  })

  it('returns icons for match statuses', () => {
    expect(matchStatusIcon('suitable')).toBe('✓')
    expect(matchStatusIcon('needs_review')).toBe('⚠')
    expect(matchStatusIcon('excluded')).toBe('✕')
  })

  it('localizes assumption and breakdown keys', () => {
    expect(assumptionLabel('utilization')).toBe('Загрузка оборудования')
    expect(breakdownLabel('equipment')).toBe('Оборудование')
    expect(formulaLabel('annual_effect')).toBe('Годовой экономический эффект')
    expect(objectParamLabel('area_m2')).toBe('Площадь')
    expect(objectParamLabel('storage_type')).toBe('Тип хранения')
    expect(objectParamLabel('rovnost_pola_otklonenie')).toBe('Ровность пола (отклонение)')
    expect(
      objectParamLabel('storage_type', {
        properties: { storage_type: { title: 'Тип хранения, код' } },
      }),
    ).toBe('Тип хранения')
    // словарь приоритетнее schema.title
    expect(
      objectParamLabel('peak_demand', {
        properties: { peak_demand: { title: 'Пиковый спрос, оп/ч' } },
      }),
    ).toBe('Пиковая нагрузка')
    expect(assumptionLabel('unknown_key')).toBe('Параметр без подписи')
    expect(unknownFieldLabel('foo_bar')).toBe('Параметр без подписи')
  })

  it('covers known user-facing keys with Russian labels (no raw snake_case)', () => {
    for (const key of KNOWN_USER_FACING_KEYS) {
      const label =
        METRIC_LABELS[key] ||
        FORMULA_OR_STATUS(key) ||
        OBJECT_PARAM_LABELS[key] ||
        ASSUMPTION_LABELS[key] ||
        MATCH_STATUS_LABELS[key] ||
        metricLabel(key)
      expect(label, key).toBeTruthy()
      expect(label, key).not.toBe(key)
      expect(label, key).not.toMatch(/_/)
    }
    expect(metricLabel('capex')).toContain('CAPEX')
    expect(objectParamLabel('current_labor_cost_year')).toMatch(/персонал/i)
    expect(objectParamLabel('peak_demand')).toMatch(/нагрузк/i)
    expect(missingCheckLabel('missing_checks')).toBe('Что необходимо проверить')
    expect(workModeLabel('2shift')).toBe('2 смены')
    expect(workModeLabel('24x7')).toMatch(/Круглосуточно/)
  })

  it('localizes admin and catalog codes', () => {
    expect(projectStatusLabel('draft')).toBe('Черновик')
    expect(auditActionLabel('economics.calculate')).toBe('Расчёт экономики')
    expect(auditActionLabel('unknown.action.xyz')).toBe('Действие журнала')
    expect(catalogTypeLabel('brs')).toBe('БРС')
    expect(catalogTypeLabel('software')).toBe('ПО')
  })

  it('formats audit details without raw JSON', () => {
    expect(formatAuditDetails({ version: 10 }, 'economics.calculate')).toBe(
      'Сохранена версия расчёта 10',
    )
    expect(formatAuditDetails({ from: 3 }, 'demo.clone')).toBe('Скопировано из проекта №3')
    expect(formatAuditDetails({ keys: ['a', 'b', 'c'] }, 'project.params_import')).toBe(
      'Импортировано параметров: 3',
    )
    expect(formatAuditEntity('project', 4, 'Склад — демо')).toBe('Проект «Склад — демо»')
  })

  it('labels value sources in Russian', () => {
    expect(valueSourceLabel('assumption')).toBe('Допущение')
    expect(valueSourceLabel('user')).toBe('Задано пользователем')
    expect(valueSourceLabel(undefined)).toBe('Допущение')
  })

  it('builds dynamic catalog stats label without hardcoded 223', () => {
    const withSource = catalogStatsLabel(187, true)
    expect(withSource).toContain('187')
    expect(withSource).not.toContain('223')
    expect(catalogStatsLabel(0, false)).toMatch(/Демонстрационный каталог/)
  })

  it('detects missing-data warnings in matching text', () => {
    expect(isMissingDataWarning('⚠ В исходных материалах отсутствуют данные о: скорость')).toBe(true)
    expect(isMissingDataWarning('✓ Грузоподъёмность достаточна')).toBe(false)
  })
})

function FORMULA_OR_STATUS(key: string): string | undefined {
  if (key === 'suitable' || key === 'needs_review' || key === 'excluded') {
    return MATCH_STATUS_LABELS[key]
  }
  if (key === 'available') return 'Доступен'
  if (key === 'estimated') return OBJECT_PARAM_LABELS.estimated
  if (key === 'missing_checks') return 'Что необходимо проверить'
  return undefined
}
