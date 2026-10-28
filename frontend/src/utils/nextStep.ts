import type { StageId, StageStatus } from '../components/project/ProjectStageNav'

export interface NextStepSuggestion {
  title: string
  reason: string
  ctaLabel: string
  step: string
  stage: StageId
}

/**
 * Рекомендуемый следующий шаг по фактическим статусам этапов (не по открытой вкладке).
 */
export function suggestNextStep(
  statuses: Partial<Record<StageId, StageStatus>>,
): NextStepSuggestion {
  if (statuses.object === 'needs_data') {
    return {
      title: 'Заполните исходные данные объекта',
      reason: 'Без ключевых параметров подбор и экономика будут ненадёжными.',
      ctaLabel: 'Заполнить параметры',
      step: 'object',
      stage: 'object',
    }
  }
  if (statuses.layout === 'ready' || statuses.layout === 'idle') {
    return {
      title: 'Настройте планировку склада',
      reason: 'Исходные данные есть. Разместите зоны и стеллажи — это основа маршрутов и DES.',
      ctaLabel: 'Открыть планировку',
      step: 'layout',
      stage: 'layout',
    }
  }
  if (statuses.selection === 'needs_data' || statuses.selection === 'ready') {
    return {
      title: 'Подберите оборудование для этой планировки',
      reason: 'Оцените предварительную пригодность решений каталога.',
      ctaLabel: 'Запустить подбор',
      step: 'selection',
      stage: 'selection',
    }
  }
  if (statuses.selection === 'warning' && statuses.economics !== 'done') {
    return {
      title: 'Проверьте характеристики в подборе',
      reason: 'Часть решений требует проверки ТТХ перед опорой на экономику.',
      ctaLabel: 'Проверить подбор',
      step: 'selection',
      stage: 'selection',
    }
  }
  if (statuses.compare === 'ready' && statuses.economics !== 'done') {
    return {
      title: 'Сравните выбранные варианты',
      reason: 'Отметьте не менее двух решений в подборе, чтобы увидеть отличия.',
      ctaLabel: 'К сравнению',
      step: 'compare',
      stage: 'compare',
    }
  }
  if (statuses.economics !== 'done' && (statuses.selection === 'done' || statuses.selection === 'warning')) {
    return {
      title: 'Рассчитайте экономический эффект',
      reason: 'Подбор выполнен — оцените инвестиции, эффект и окупаемость.',
      ctaLabel: 'Открыть экономику',
      step: 'economics',
      stage: 'economics',
    }
  }
  if (statuses.economics === 'done' && statuses.visualization !== 'done') {
    return {
      title: 'Посмотрите симуляцию на плане',
      reason: 'DES иллюстрирует задания на схеме (не цифровой двойник). Затем можно сформировать отчёт.',
      ctaLabel: 'Открыть моделирование',
      step: 'visualization',
      stage: 'visualization',
    }
  }
  if (statuses.economics === 'done') {
    return {
      title: 'Сформируйте отчёт для обсуждения',
      reason: 'Базовый расчёт готов. Скачайте PDF/Excel или откройте краткое резюме.',
      ctaLabel: 'Открыть отчёт',
      step: 'report',
      stage: 'report',
    }
  }
  return {
    title: 'Продолжите работу с проектом',
    reason: 'Выберите этап в навигации слева.',
    ctaLabel: 'К параметрам объекта',
    step: 'object',
    stage: 'object',
  }
}
