/** Общие подписи типов объектов планировки (2D и Spatial Studio). */

export const LAYOUT_KIND_OPTIONS = [
  { value: 'rack', label: 'Стеллаж' },
  { value: 'obstacle', label: 'Препятствие' },
  { value: 'zone', label: 'Зона' },
  { value: 'charge', label: 'Зарядка' },
  { value: 'load', label: 'Приёмка' },
  { value: 'unload', label: 'Отгрузка' },
  { value: 'start', label: 'Старт роботов' },
  { value: 'wall', label: 'Стена / контур' },
] as const

export function layoutKindLabel(kind: string): string {
  return LAYOUT_KIND_OPTIONS.find((k) => k.value === kind)?.label || kind
}

export function newLayoutObjectId(kind: string): string {
  return `${kind}_${Math.random().toString(36).slice(2, 9)}`
}

export type SpatialTool = 'select' | 'move' | 'rotate'

export type SpatialSaveStatus = 'saved' | 'dirty' | 'saving' | 'error'
