import type { ProjectParams } from '../../types'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { objectParamLabel } from '../../utils/labels'

export interface ParamSchemaProperty {
  type?: string
  title?: string
  enum?: string[]
  unit?: string
}

export interface ParamSchema {
  properties?: Record<string, ParamSchemaProperty>
}

interface FieldDef {
  key: string
  label: string
  unit?: string
  type?: 'number' | 'text' | 'select' | 'boolean'
  options?: { value: string; label: string }[]
  step?: string
}

/** Ключи совпадают с backend seed / расчётной моделью */
const WAREHOUSE_FIELDS: FieldDef[] = [
  { key: 'area_width_m', label: 'Ширина площадки', unit: 'м', type: 'number', step: '0.1' },
  { key: 'area_length_m', label: 'Длина площадки', unit: 'м', type: 'number', step: '0.1' },
  { key: 'aisle_width_mm', label: 'Ширина проходов', unit: 'мм', type: 'number' },
  { key: 'required_payload_kg', label: 'Требуемая грузоподъёмность', unit: 'кг', type: 'number' },
  { key: 'peak_demand', label: 'Пиковый спрос', unit: 'оп/ч', type: 'number' },
  { key: 'zones_count', label: 'Число рабочих зон', type: 'number' },
  { key: 'charging_stations', label: 'Зарядных станций', type: 'number' },
  { key: 'current_labor_cost_year', label: 'Стоимость персонала', unit: '₽/год', type: 'number' },
  { key: 'temperature_min_c', label: 'Температура мин.', unit: '°C', type: 'number' },
  { key: 'temperature_max_c', label: 'Температура макс.', unit: '°C', type: 'number' },
  {
    key: 'storage_type',
    label: 'Тип хранения',
    type: 'select',
    options: [
      { value: 'pallet', label: 'Паллетное' },
      { value: 'shelf', label: 'Полочное' },
      { value: 'mixed', label: 'Смешанное' },
    ],
  },
]

const AIRPORT_FIELDS: FieldDef[] = [
  { key: 'area_width_m', label: 'Ширина зоны', unit: 'м', type: 'number', step: '0.1' },
  { key: 'area_length_m', label: 'Длина зоны', unit: 'м', type: 'number', step: '0.1' },
  { key: 'aisle_width_mm', label: 'Ширина проездов', unit: 'мм', type: 'number' },
  { key: 'required_payload_kg', label: 'Масса перемещаемых объектов', unit: 'кг', type: 'number' },
  { key: 'peak_demand', label: 'Пиковая нагрузка', unit: 'оп/ч', type: 'number' },
  { key: 'zones_count', label: 'Число зон операции', type: 'number' },
  { key: 'charging_stations', label: 'Зарядных станций', type: 'number' },
  { key: 'current_labor_cost_year', label: 'Стоимость персонала', unit: '₽/год', type: 'number' },
  {
    key: 'zone_type',
    label: 'Тип зоны',
    type: 'select',
    options: [
      { value: 'apron', label: 'Перрон' },
      { value: 'terminal', label: 'Терминал' },
      { value: 'baggage', label: 'Багажный комплекс' },
      { value: 'mixed', label: 'Смешанная' },
    ],
  },
]

const MEDICAL_FIELDS: FieldDef[] = [
  { key: 'area_width_m', label: 'Ширина корпуса', unit: 'м', type: 'number', step: '0.1' },
  { key: 'area_length_m', label: 'Длина корпуса', unit: 'м', type: 'number', step: '0.1' },
  { key: 'aisle_width_mm', label: 'Ширина коридоров', unit: 'мм', type: 'number' },
  { key: 'required_payload_kg', label: 'Масса грузовой единицы', unit: 'кг', type: 'number' },
  { key: 'peak_demand', label: 'Количество перевозок', unit: 'оп/ч', type: 'number' },
  { key: 'zones_count', label: 'Число отделений / зон', type: 'number' },
  { key: 'floors_count', label: 'Этажность', type: 'number' },
  { key: 'charging_stations', label: 'Зарядных станций', type: 'number' },
  { key: 'current_labor_cost_year', label: 'Стоимость персонала', unit: '₽/год', type: 'number' },
  { key: 'humidity_max_pct', label: 'Влажность макс.', unit: '%', type: 'number' },
  {
    key: 'facility_type',
    label: 'Тип учреждения',
    type: 'select',
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
      if (def.enum?.length) {
        return {
          key,
          label: def.title || objectParamLabel(key),
          type: 'select' as const,
          options: def.enum.map((v) => ({ value: v, label: v })),
        }
      }
      if (def.type === 'boolean') {
        return { key, label: def.title || objectParamLabel(key), type: 'boolean' as const }
      }
      if (def.type === 'string') {
        return { key, label: def.title || objectParamLabel(key), type: 'text' as const }
      }
      return {
        key,
        label: def.title || objectParamLabel(key),
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
}

export function ObjectParamsForm({ objectType, values, onChange, schema }: ObjectParamsFormProps) {
  const fields =
    schema?.properties && Object.keys(schema.properties).length > 0
      ? schemaToFields(schema)
      : BY_TYPE[objectType] || WAREHOUSE_FIELDS

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((f) => {
        if (f.type === 'select') {
          return (
            <Select
              key={f.key}
              label={f.label}
              value={String(values[f.key] ?? '')}
              onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
              options={f.options || []}
              placeholder="Выберите значение"
            />
          )
        }
        if (f.type === 'boolean') {
          return (
            <Select
              key={f.key}
              label={f.label}
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
            />
          )
        }
        if (f.type === 'text') {
          return (
            <Input
              key={f.key}
              label={f.label}
              type="text"
              value={values[f.key] == null ? '' : String(values[f.key])}
              onChange={(e) =>
                onChange({
                  ...values,
                  [f.key]: e.target.value === '' ? null : e.target.value,
                })
              }
            />
          )
        }
        return (
          <Input
            key={f.key}
            label={f.unit ? `${f.label}, ${f.unit}` : f.label}
            type="number"
            step={f.step || '1'}
            value={values[f.key] === undefined || values[f.key] === null ? '' : String(values[f.key])}
            onChange={(e) =>
              onChange({
                ...values,
                [f.key]: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        )
      })}
    </div>
  )
}
