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

/** Форматирование строки CAPEX/OPEX breakdown с корректными единицами */
export function formatBreakdownValue(key: string, value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return value == null ? MISSING_VALUE : String(value)
  }
  if (key === 'ops_staff_count') {
    return `${formatNumber(value, 0)} чел.`
  }
  if (
    key === 'charging_stations_count' ||
    key === 'robots_count' ||
    key === 'stations' ||
    (key.endsWith('_count') && key !== 'ops_staff_count')
  ) {
    return `${formatNumber(value, 0)} шт.`
  }
  return formatCurrency(value)
}

/** Окупаемость: месяцы при сроке < 1 года, иначе годы; не показывать «0,0 лет» */
export function formatPayback(
  payback?: {
    payback_years?: number | null
    payback_months?: number | null
    payback_display?: string | null
    message?: string | null
    simple_payback_years?: number | null
    horizon_years?: number | null
  } | null,
): string {
  if (!payback) return MISSING_VALUE
  const y = payback.payback_years
  if (y != null && !Number.isNaN(y)) {
    if (payback.payback_display) return payback.payback_display
    if (y < 1 / 12) return 'менее 1 месяца'
    if (y < 1) {
      const months = payback.payback_months ?? y * 12
      return `${formatNumber(months, 1)} мес.`
    }
    const digits = y < 0.1 ? 3 : y < 10 ? 2 : 1
    return `${formatNumber(y, digits)} лет`
  }
  // CF за горизонт не вышли в плюс — расчёт выполнен; показываем простую оценку, если есть.
  const simple = payback.simple_payback_years
  if (simple != null && !Number.isNaN(Number(simple))) {
    const horizon = payback.horizon_years
    const prefix = horizon != null ? `> ${horizon} лет` : 'За горизонтом'
    return `${prefix} · ≈ ${formatNumber(Number(simple), 1)} лет (инвестиции / годовой эффект)`
  }
  if (payback.message && /эффект\s*≤\s*0/i.test(payback.message)) {
    return 'Не определена (эффект ≤ 0)'
  }
  return payback.message ? 'Не достигнута на горизонте' : 'Не окупается на горизонте'
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
