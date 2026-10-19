import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectParams } from '../../types'
import { objectParamLabel } from '../../utils/labels'
import { paramFieldDomId } from '../../utils/attention'
import {
  COMPACT_FIELD_KEYS,
  fieldRequirement,
} from '../../utils/requiredInputs'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'

interface ParamSchema {
  properties?: Record<
    string,
    {
      type?: string
      title?: string
      enum?: string[]
      description?: string
    }
  >
}

type FieldType = 'number' | 'text' | 'select' | 'boolean'

interface FieldDef {
  key: string
  label: string
  type: FieldType
  unit?: string
  step?: string
  hint?: string
  example?: string
  required?: boolean
  options?: { value: string; label: string }[]
  group: string
}

const GROUPS = [
  { id: 'area', title: 'Об объекте и площадке' },
  { id: 'ops', title: 'Потоки и производительность' },
  { id: 'staff', title: 'Персонал и затраты' },
  { id: 'infra', title: 'Ограничения площадки' },
  { id: 'other', title: 'Прочие параметры' },
] as const

function groupForKey(key: string): string {
  if (
    /area|width|length|height|aisle|rack|floor|layout|zone/i.test(key)
  ) {
    return 'area'
  }
  if (/peak|ops|shift|hour|throughput|demand|volume|pallet|cycle/i.test(key)) {
    return 'ops'
  }
  if (/staff|labor|salary|wage|fot|personnel|headcount|cost_year/i.test(key)) {
    return 'staff'
  }
  if (
    /temp|humidity|wifi|network|charge|payload|slope|door|infra|wifi|5g|power/i.test(key)
  ) {
    return 'infra'
  }
  return 'other'
}

const WAREHOUSE_FIELDS: FieldDef[] = [
  {
    key: 'area_m2',
    label: 'Площадь склада',
    unit: 'м²',
    type: 'number',
    group: 'area',
    hint: 'Полезная площадь зоны хранения и комплектации (для планировки/DES)',
    example: '12000',
  },
  {
    key: 'area_width_m',
    label: 'Ширина площадки',
    unit: 'м',
    type: 'number',
    group: 'area',
    hint: 'Габарит по ширине для планировки',
    example: '80',
  },
  {
    key: 'area_length_m',
    label: 'Длина площадки',
    unit: 'м',
    type: 'number',
    group: 'area',
    hint: 'Габарит по длине для планировки',
    example: '150',
  },
  {
    key: 'aisle_width_mm',
    label: 'Ширина прохода',
    unit: 'мм',
    type: 'number',
    group: 'area',
    hint: 'Минимальная ширина проезда между стеллажами (необязательно для экономики)',
    example: '2800',
  },
  {
    key: 'peak_demand',
    label: 'Пиковая нагрузка',
    unit: 'оп/ч',
    type: 'number',
    group: 'ops',
    required: true,
    hint: 'Обязательно для экономики: число роботов и CAPEX',
    example: '6800',
  },
  {
    key: 'unit_price',
    label: 'Цена решения (если не из каталога)',
    unit: '₽',
    type: 'number',
    group: 'ops',
    hint: 'Условно обязательно: если решение ещё не выбрано в каталоге',
    example: '4500000',
  },
  {
    key: 'shifts_per_day',
    label: 'Смен в сутки',
    type: 'number',
    group: 'ops',
    example: '2',
  },
  {
    key: 'hours_per_shift',
    label: 'Часов в смене',
    type: 'number',
    group: 'ops',
    example: '8',
  },
  {
    key: 'staff_count',
    label: 'Численность персонала',
    unit: 'чел.',
    type: 'number',
    group: 'staff',
    hint: 'Операционный персонал на участке автоматизации',
    example: '40',
  },
  {
    key: 'current_labor_cost_year',
    label: 'Стоимость персонала',
    unit: '₽/год',
    type: 'number',
    group: 'staff',
    hint: 'Годовой ФОТ участка. Альтернатива: численность + з/п в месяц',
    example: '48000000',
  },
  {
    key: 'staff_salary_month',
    label: 'З/п сотрудника (мес.)',
    unit: '₽/мес',
    type: 'number',
    group: 'staff',
    hint: 'Для производного расчёта годовых затрат вместе с численностью',
    example: '100000',
  },
  {
    key: 'required_payload_kg',
    label: 'Требуемая грузоподъёмность',
    unit: 'кг',
    type: 'number',
    group: 'infra',
    hint: 'Максимальная масса груза на одну операцию',
    example: '1000',
  },
  {
    key: 'temp_min_c',
    label: 'Температура мин.',
    unit: '°C',
    type: 'number',
    group: 'infra',
  },
  {
    key: 'temp_max_c',
    label: 'Температура макс.',
    unit: '°C',
    type: 'number',
    group: 'infra',
  },
  {
    key: 'charging_stations',
    label: 'Зарядных станций',
    type: 'number',
    group: 'infra',
  },
]

const AIRPORT_FIELDS: FieldDef[] = [
  {
    key: 'area_m2',
    label: 'Площадь зоны',
    unit: 'м²',
    type: 'number',
    group: 'area',
    required: true,
  },
  {
    key: 'peak_demand',
    label: 'Пиковый поток',
    unit: 'оп/ч',
    type: 'number',
    group: 'ops',
    required: true,
    hint: 'Глубина расчёта для аэропорта частичная — проверьте допущения',
  },
  {
    key: 'staff_count',
    label: 'Численность персонала',
    unit: 'чел.',
    type: 'number',
    group: 'staff',
  },
  {
    key: 'current_labor_cost_year',
    label: 'Стоимость персонала',
    unit: '₽/год',
    type: 'number',
    group: 'staff',
  },
  {
    key: 'required_payload_kg',
    label: 'Грузоподъёмность',
    unit: 'кг',
    type: 'number',
    group: 'infra',
  },
]

const MEDICAL_FIELDS: FieldDef[] = [
  {
    key: 'area_m2',
    label: 'Площадь корпуса / зоны',
    unit: 'м²',
    type: 'number',
    group: 'area',
    required: true,
  },
  {
    key: 'peak_demand',
    label: 'Пиковый поток заданий',
    unit: 'оп/ч',
    type: 'number',
    group: 'ops',
    required: true,
    hint: 'Для медицины расчёты ориентировочные — уточняйте процессы на объекте',
  },
  {
    key: 'staff_count',
    label: 'Численность персонала',
    unit: 'чел.',
    type: 'number',
    group: 'staff',
  },
  {
    key: 'current_labor_cost_year',
    label: 'Стоимость персонала',
    unit: '₽/год',
    type: 'number',
    group: 'staff',
  },
  {
    key: 'humidity_max_pct',
    label: 'Влажность макс.',
    unit: '%',
    type: 'number',
    group: 'infra',
  },
  {
    key: 'facility_type',
    label: 'Тип учреждения',
    type: 'select',
    group: 'other',
    options: [
      { value: 'hospital', label: 'Больница' },
      { value: 'clinic', label: 'Клиника' },
      { value: 'lab', label: 'Лаборатория' },
    ],
  },
]

const BY_TYPE: Record<string, FieldDef[]> = {
  warehouse: WAREHOUSE_FIELDS,
  airport: AIRPORT_FIELDS,
  medical: MEDICAL_FIELDS,
}

function schemaToFields(schema: ParamSchema): FieldDef[] {
  const props = schema.properties || {}
  return Object.entries(props)
    .filter(([, def]) => {
      const t = def.type || 'string'
      return t === 'number' || t === 'integer' || t === 'string' || t === 'boolean' || !!def.enum
    })
    .map(([key, def]) => {
      const group = groupForKey(key)
      const base = {
        key,
        label: objectParamLabel(key, schema) || def.title || key,
        group,
        hint: def.description,
      }
      if (def.enum?.length) {
        return {
          ...base,
          type: 'select' as const,
          options: def.enum.map((v) => ({ value: v, label: v })),
        }
      }
      if (def.type === 'boolean') {
        return { ...base, type: 'boolean' as const }
      }
      if (def.type === 'string') {
        return { ...base, type: 'text' as const }
      }
      return {
        ...base,
        type: 'number' as const,
        step: def.type === 'integer' ? '1' : '0.1',
      }
    })
}

interface ObjectParamsFormProps {
  objectType: string
  values: ProjectParams
  onChange: (next: ProjectParams) => void
  schema?: ParamSchema | null
  readOnly?: boolean
  /** Прокрутить и сфокусировать поле (например с AttentionPanel). */
  focusField?: string | null
  onFocusHandled?: () => void
  /** Компактный режим: только поля минимального набора + связанные */
  compactMode?: boolean
  onCompactModeChange?: (compact: boolean) => void
  fieldErrors?: Record<string, string>
  /** Цена выбранного решения из каталога — снимает условную обязательность unit_price */
  robotPrice?: number | null
}

function FieldHint({
  hint,
  example,
  required,
  reason,
  category,
}: {
  hint?: string
  example?: string
  required?: boolean
  reason?: string
  category?: string
}) {
  if (!hint && !example && !required && !reason) return null
  return (
    <p className="mt-1 text-xs text-steel-500">
      {required && (
        <span className="font-medium text-brand-800">
          {category === 'conditional' ? 'Условно обязательно. ' : 'Обязательно. '}
        </span>
      )}
      {reason ? <span className="text-steel-600">{reason}. </span> : null}
      {hint}
      {example && (
        <span className="text-steel-400">
          {' '}
          Пример: <span className="font-mono text-steel-600">{example}</span>
        </span>
      )}
    </p>
  )
}

export function ObjectParamsForm({
  objectType,
  values,
  onChange,
  schema,
  readOnly = false,
  focusField = null,
  onFocusHandled,
  compactMode = false,
  onCompactModeChange,
  fieldErrors = {},
  robotPrice = null,
}: ObjectParamsFormProps) {
  const fallbackFields = BY_TYPE[objectType] || WAREHOUSE_FIELDS

  const allFields = useMemo(() => {
    const base =
      schema?.properties && Object.keys(schema.properties).length > 0
        ? schemaToFields(schema)
        : fallbackFields
    // Схема каталога может не содержать unit_price / staff_salary — дополняем
    // полями минимального набора из типового шаблона, не дублируя ключи.
    const have = new Set(base.map((f) => f.key))
    const extras = fallbackFields.filter(
      (f) =>
        !have.has(f.key) &&
        ((COMPACT_FIELD_KEYS as readonly string[]).includes(f.key) || Boolean(f.required)),
    )
    return extras.length ? [...base, ...extras] : base
  }, [schema, fallbackFields])

  const priceOpts = useMemo(() => ({ robotPrice }), [robotPrice])

  const fields = useMemo(() => {
    if (!compactMode) return allFields
    const compactSet = new Set<string>(COMPACT_FIELD_KEYS as unknown as string[])
    // всегда показываем обязательные/условные по текущим values
    return allFields.filter((f) => {
      if (compactSet.has(f.key)) return true
      const req = fieldRequirement(f.key, values, priceOpts)
      return req.required
    })
  }, [allFields, compactMode, values, priceOpts])

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.map((g) => [g.id, true])),
  )
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields
  const onFocusHandledRef = useRef(onFocusHandled)
  onFocusHandledRef.current = onFocusHandled

  const byGroup = GROUPS.map((g) => ({
    ...g,
    fields: fields.filter((f) => f.group === g.id),
  })).filter((g) => g.fields.length > 0)

  useEffect(() => {
    if (!focusField) return
    const field = fieldsRef.current.find((f) => f.key === focusField)
    const gid = field?.group || groupForKey(focusField)
    setOpenGroups((s) => (s[gid] === true ? s : { ...s, [gid]: true }))
    setHighlightKey(focusField)

    let cancelled = false
    let attempts = 0
    let retryT = 0
    const run = () => {
      if (cancelled) return
      const wrap = document.getElementById(paramFieldDomId(focusField))
      if (wrap) {
        wrap.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const control = wrap.querySelector<HTMLElement>('input, select, textarea')
        control?.focus({ preventScroll: true })
        onFocusHandledRef.current?.()
        return
      }
      attempts += 1
      if (attempts < 8) {
        retryT = window.setTimeout(run, 100)
        return
      }
      // поле отсутствует в схеме формы — хотя бы прокрутим к блоку параметров
      document.getElementById('object-params-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      onFocusHandledRef.current?.()
    }
    const t = window.setTimeout(run, 50)
    const clearHl = window.setTimeout(() => {
      if (!cancelled) setHighlightKey(null)
    }, 2400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
      window.clearTimeout(retryT)
      window.clearTimeout(clearHl)
    }
  }, [focusField])

  const wrapClass = (key: string) =>
    highlightKey === key
      ? 'rounded-md ring-2 ring-brand-500 ring-offset-2 transition-shadow'
      : undefined

  return (
    <div id="object-params-form" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-steel-500">
          {compactMode
            ? 'Компактный режим: поля для базового расчёта. Остальные значения сохраняются.'
            : 'Полный список параметров объекта.'}
        </p>
        {onCompactModeChange ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onCompactModeChange(!compactMode)}
            data-testid="params-compact-toggle"
          >
            {compactMode ? 'Все параметры' : 'Только обязательные'}
          </Button>
        ) : null}
      </div>
      {byGroup.map((g) => {
        const open = openGroups[g.id] ?? true
        const filled = g.fields.filter((f) => values[f.key] != null && values[f.key] !== '').length
        return (
          <div key={g.id} className="rounded border border-steel-200 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-steel-50/80"
              onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !open }))}
              aria-expanded={open}
            >
              <span className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
                {g.title}
              </span>
              <span className="font-mono text-[11px] text-steel-500">
                {filled}/{g.fields.length} · {open ? 'Свернуть' : 'Развернуть'}
              </span>
            </button>
            {open && (
              <div className="grid gap-4 border-t border-steel-100 px-4 py-4 md:grid-cols-2">
                {g.fields.map((f) => {
                  const req = fieldRequirement(f.key, values, priceOpts)
                  const isReq = req.required || Boolean(f.required)
                  const err = fieldErrors[f.key]
                  const source =
                    values[f.key] != null && values[f.key] !== ''
                      ? 'Текущее значение задано'
                      : 'Не задано'
                  const fid = paramFieldDomId(f.key)
                  const labelSuffix = isReq ? ' *' : ''
                  if (f.type === 'select') {
                    return (
                      <div key={f.key} id={fid} data-param-field={f.key} className={wrapClass(f.key)}>
                        <Select
                          label={`${f.label}${labelSuffix}`}
                          value={String(values[f.key] ?? '')}
                          onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
                          options={f.options || []}
                          placeholder="Выберите значение"
                          disabled={readOnly}
                          aria-invalid={Boolean(err)}
                        />
                        <FieldHint
                          hint={f.hint}
                          example={f.example}
                          required={isReq}
                          reason={req.reason}
                          category={req.category}
                        />
                        {err ? <p className="mt-0.5 text-xs text-red-600">{err}</p> : null}
                        <p className="mt-0.5 text-[11px] text-steel-400">{source}</p>
                      </div>
                    )
                  }
                  if (f.type === 'boolean') {
                    return (
                      <div key={f.key} id={fid} data-param-field={f.key} className={wrapClass(f.key)}>
                        <Select
                          label={`${f.label}${labelSuffix}`}
                          value={
                            values[f.key] === true || values[f.key] === 'true'
                              ? 'true'
                              : values[f.key] === false || values[f.key] === 'false'
                                ? 'false'
                                : ''
                          }
                          onChange={(e) =>
                            onChange({
                              ...values,
                              [f.key]: e.target.value === '' ? null : e.target.value === 'true',
                            })
                          }
                          options={[
                            { value: 'true', label: 'Да' },
                            { value: 'false', label: 'Нет' },
                          ]}
                          placeholder="Выберите значение"
                          disabled={readOnly}
                        />
                        <FieldHint
                          hint={f.hint}
                          required={isReq}
                          reason={req.reason}
                          category={req.category}
                        />
                        {err ? <p className="mt-0.5 text-xs text-red-600">{err}</p> : null}
                      </div>
                    )
                  }
                  if (f.type === 'text') {
                    return (
                      <div key={f.key} id={fid} data-param-field={f.key} className={wrapClass(f.key)}>
                        <Input
                          label={`${f.label}${labelSuffix}`}
                          type="text"
                          value={values[f.key] == null ? '' : String(values[f.key])}
                          onChange={(e) =>
                            onChange({
                              ...values,
                              [f.key]: e.target.value === '' ? null : e.target.value,
                            })
                          }
                          disabled={readOnly}
                          readOnly={readOnly}
                          error={err}
                        />
                        <FieldHint
                          hint={f.hint}
                          example={f.example}
                          required={isReq}
                          reason={req.reason}
                          category={req.category}
                        />
                        <p className="mt-0.5 text-[11px] text-steel-400">{source}</p>
                      </div>
                    )
                  }
                  return (
                    <div key={f.key} id={fid} data-param-field={f.key} className={wrapClass(f.key)}>
                      <Input
                        label={
                          f.unit
                            ? `${f.label}, ${f.unit}${labelSuffix}`
                            : `${f.label}${labelSuffix}`
                        }
                        type="number"
                        step={f.step || '1'}
                        value={
                          values[f.key] === undefined || values[f.key] === null
                            ? ''
                            : String(values[f.key])
                        }
                        onChange={(e) =>
                          onChange({
                            ...values,
                            [f.key]: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        disabled={readOnly}
                        readOnly={readOnly}
                        error={err}
                      />
                      <FieldHint
                        hint={f.hint}
                        example={f.example}
                        required={isReq}
                        reason={req.reason}
                        category={req.category}
                      />
                      <p className="mt-0.5 text-[11px] text-steel-400">{source}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
