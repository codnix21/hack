const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

const currencyPrecise = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('ru-RU')

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Короткий текст для отсутствующих числовых значений в таблицах/KPI */
export const MISSING_VALUE = 'Нет данных'

function isMissingNumber(value?: number | null): boolean {
  return value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)
}

export function formatCurrency(value?: number | null, precise = false): string {
  if (isMissingNumber(value)) return MISSING_VALUE
  return (precise ? currencyPrecise : currencyFormatter).format(value as number)
}

export function formatNumber(value?: number | null, digits = 0): string {
  if (isMissingNumber(value)) return MISSING_VALUE
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value as number)
}

export function formatPercent(value?: number | null, digits = 1): string {
  if (isMissingNumber(value)) return MISSING_VALUE
  return `${formatNumber(value, digits)} %`
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return MISSING_VALUE
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return MISSING_VALUE
  return dateFormatter.format(d)
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return MISSING_VALUE
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return MISSING_VALUE
  return dateTimeFormatter.format(d)
}

export function formatUnit(value?: number | null, unit = '', digits = 1): string {
  if (isMissingNumber(value)) return MISSING_VALUE
  const formatted = numberFormatter.format(
    Number((value as number).toFixed(digits)),
  )
  return unit ? `${formatted} ${unit}` : formatted
}

export function formatKg(value?: number | null): string {
  return formatUnit(value, 'кг', 1)
}

export function formatMeters(value?: number | null): string {
  return formatUnit(value, 'м', 1)
}

export function formatHours(value?: number | null): string {
  return formatUnit(value, 'ч', 1)
}

export function formatMps(value?: number | null): string {
  return formatUnit(value, 'м/с', 2)
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

export function paginationLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return 'Показано 0 из 0'
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return `Показано ${from}–${to} из ${total}`
}

export const OBJECT_TYPE_LABELS: Record<string, string> = {
  warehouse: 'Склад',
  airport: 'Аэропорт',
  medical: 'Медицинское учреждение',
  custom: 'Другой объект',
}

export { PROJECT_STATUS_LABELS } from './labels'
