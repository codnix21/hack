import { describe, expect, it } from 'vitest'
import {
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
  objectParamLabel,
  projectStatusLabel,
  valueSourceLabel,
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
    expect(matchStatusLabel('suitable')).toBe('Подходит')
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
    expect(formulaLabel('annual_effect')).toBe('Годовой эффект')
    expect(objectParamLabel('area_m2')).toBe('Площадь')
    expect(objectParamLabel('storage_type')).toBe('Тип хранения')
    expect(objectParamLabel('rovnost_pola_otklonenie')).toBe('Ровность пола (отклонение)')
    expect(
      objectParamLabel('storage_type', {
        properties: { storage_type: { title: 'Тип хранения, код' } },
      }),
    ).toBe('Тип хранения')
    expect(assumptionLabel('unknown_key')).toBe('unknown_key')
  })

  it('localizes admin and catalog codes', () => {
    expect(projectStatusLabel('draft')).toBe('Черновик')
    expect(auditActionLabel('economics.calculate')).toBe('Расчёт экономики')
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
