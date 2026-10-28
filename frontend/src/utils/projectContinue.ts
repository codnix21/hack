import type { Project } from '../types'

/** Грубая оценка следующего шага по summary проекта (без полного workspace state). */
export function continueStepForProject(p: Project): {
  step: string
  label: string
} {
  if (p.summary?.capex != null) {
    return { step: 'report', label: 'Отчёт' }
  }
  if (p.summary?.robots_count != null) {
    return { step: 'economics', label: 'Экономика' }
  }
  return { step: 'object', label: 'Данные' }
}

export function projectNeedsAttention(p: Project): boolean {
  if (p.status === 'archived' || p.status === 'completed') return false
  return p.summary?.capex == null
}
