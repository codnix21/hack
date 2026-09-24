import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { importApi } from '../../api/import'
import { projectsApi } from '../../api/projects'
import { getFriendlyError } from '../../api/client'
import type { ImportPreview } from '../../types'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Table } from '../ui/Table'
import { toastError, toastSuccess } from '../../store/toastStore'
import { objectParamLabel } from '../../utils/labels'

const TARGET_FIELDS = [
  { value: 'area_width_m', label: 'Ширина площадки' },
  { value: 'area_length_m', label: 'Длина площадки' },
  { value: 'aisle_width_mm', label: 'Ширина проходов' },
  { value: 'required_payload_kg', label: 'Грузоподъёмность' },
  { value: 'peak_demand', label: 'Пиковый спрос' },
  { value: 'zones_count', label: 'Число зон' },
  { value: 'charging_stations', label: 'Зарядных станций' },
  { value: 'current_labor_cost_year', label: 'Затраты на труд / год' },
  { value: 'temperature_min_c', label: 'Температура мин.' },
  { value: 'temperature_max_c', label: 'Температура макс.' },
  { value: 'storage_type', label: 'Тип хранения' },
  { value: 'floors_count', label: 'Этажность' },
  { value: 'humidity_max_pct', label: 'Влажность макс.' },
  { value: 'zone_type', label: 'Тип зоны' },
  { value: 'facility_type', label: 'Тип учреждения' },
  { value: 'ignore', label: 'Игнорировать' },
]

interface ImportFlowProps {
  projectId: string
}

type Step = 'file' | 'preview' | 'validation' | 'done'

type ParamSchema = {
  properties?: Record<string, { title?: string } | undefined>
} | null

export function ImportFlow({ projectId }: ImportFlowProps) {
  const [step, setStep] = useState<Step>('file')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [rowCount, setRowCount] = useState(0)
  const [importedKeys, setImportedKeys] = useState<string[]>([])

  const paramsQuery = useQuery({
    queryKey: ['project-params', projectId],
    queryFn: () => projectsApi.getParams(projectId),
  })
  const paramSchema = (paramsQuery.data?.parameter_schema as ParamSchema) || null

  const isKeyValue = preview?.mode === 'key_value'
  const recognizedCount = useMemo(() => {
    if (importedKeys.length) return importedKeys.length
    if (preview?.parsed_params) return Object.keys(preview.parsed_params).length
    return 0
  }, [importedKeys, preview])

  const previewMut = useMutation({
    mutationFn: (f: File) => importApi.preview(projectId, f),
    onSuccess: (data) => {
      const normalized: ImportPreview = {
        ...data,
        sample_rows: data.sample_rows ?? (data as { preview?: Record<string, string>[] }).preview ?? [],
        total_rows: data.total_rows ?? (data as { row_count?: number }).row_count ?? 0,
      }
      setPreview(normalized)
      const suggested = normalized.suggested_mapping || {}
      const initial: Record<string, string> = {}
      normalized.columns.forEach((c) => {
        initial[c] = suggested[c] || 'ignore'
      })
      setMapping(initial)
      setStep('preview')
      toastSuccess('Файл загружен для предварительного просмотра')
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const validateMut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Файл не выбран')
      return importApi.validate(projectId, mapping, file)
    },
    onSuccess: (data) => {
      setRowCount(data.row_count)
      setStep('validation')
      toastSuccess('Данные проверены')
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const confirmMut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Файл не выбран')
      return importApi.confirm(projectId, mapping, file)
    },
    onSuccess: (data) => {
      setImportedKeys(Object.keys(data.object_params || {}))
      setStep('done')
      void paramsQuery.refetch()
      toastSuccess(data.message || 'Параметры импортированы')
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const templateMut = useMutation({
    mutationFn: () => importApi.downloadParamsTemplate(projectId),
    onSuccess: () => toastSuccess('Шаблон скачан'),
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const sampleRows = useMemo(() => preview?.sample_rows ?? [], [preview])

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2 text-xs font-medium text-steel-500">
        {[
          ['file', 'Выбор файла'],
          ['preview', 'Просмотр и сопоставление'],
          ['validation', 'Проверка'],
          ['done', 'Подтверждение'],
        ].map(([id, label]) => (
          <li
            key={id}
            className={`rounded-md px-2.5 py-1 ${
              step === id ? 'bg-brand-100 text-brand-800' : 'bg-steel-100'
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {step === 'file' && (
        <div className="space-y-4">
          <div className="rounded border border-steel-200 bg-white p-4">
            <p className="font-medium text-steel-900">1. Скачайте шаблон Excel</p>
            <p className="mt-1 text-sm text-steel-600">
              Откройте лист «Параметры» и заполните жёлтую колонку «Значение». Названия параметров и
              единицы уже указаны — менять их не нужно.
            </p>
            <Button
              className="mt-3"
              variant="outline"
              loading={templateMut.isPending}
              onClick={() => templateMut.mutate()}
              aria-label="Скачать шаблон Excel"
            >
              <Download className="h-4 w-4" />
              Скачать шаблон Excel
            </Button>
          </div>

          <div className="rounded border border-dashed border-steel-300 bg-steel-50/60 p-8 text-center">
            <Upload className="mx-auto mb-3 h-8 w-8 text-steel-400" />
            <p className="font-medium text-steel-900">2. Загрузите заполненный файл</p>
            <p className="mt-1 text-sm text-steel-600">
              Excel по шаблону (лист «Параметры») или CSV/Excel с колонками параметров
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="mx-auto mt-4 block text-sm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              aria-label="Выберите файл для импорта"
            />
            <Button
              className="mt-4"
              disabled={!file}
              loading={previewMut.isPending}
              onClick={() => file && previewMut.mutate(file)}
            >
              Загрузить и показать
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <>
          <p className="text-sm text-steel-600">
            Всего строк в файле: <strong>{preview.total_rows}</strong>
            {preview.parsed_params && (
              <> · распознано параметров: {Object.keys(preview.parsed_params).length}</>
            )}
            {isKeyValue && (
              <span className="mt-1 block text-steel-500">
                Формат «Параметр / Значение» — сопоставление колонок не требуется.
              </span>
            )}
          </p>
          <div className="overflow-hidden rounded border border-steel-200">
            <Table
              columns={preview.columns.map((c) => ({
                key: c,
                header: c,
                render: (row: Record<string, string>) => row[c] ?? '—',
              }))}
              rows={sampleRows.map((row, i) => ({ ...row, __i: String(i) }))}
              rowKey={(row) => row.__i}
            />
          </div>
          {!isKeyValue && (
            <div className="grid gap-3 md:grid-cols-2">
              {preview.columns.map((col) => (
                <Select
                  key={col}
                  label={`Колонка «${col}»`}
                  value={mapping[col] || 'ignore'}
                  onChange={(e) => setMapping((m) => ({ ...m, [col]: e.target.value }))}
                  options={TARGET_FIELDS}
                />
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('file')}>
              Назад
            </Button>
            <Button loading={validateMut.isPending} onClick={() => validateMut.mutate()}>
              Проверить данные
            </Button>
          </div>
        </>
      )}

      {(step === 'validation' || step === 'done') && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-steel-200 bg-white p-4">
              <p className="text-xs text-steel-500">Строк в файле</p>
              <p className="mt-1 text-2xl font-semibold text-steel-900">
                {rowCount || preview?.total_rows || 0}
              </p>
            </div>
            <div className="rounded-lg border border-steel-200 bg-white p-4">
              <p className="text-xs text-steel-500">
                {isKeyValue ? 'Распознано параметров' : 'Сопоставленных колонок'}
              </p>
              <p className="mt-1 text-2xl font-semibold text-steel-900">
                {isKeyValue
                  ? recognizedCount
                  : Object.values(mapping).filter((v) => v && v !== 'ignore').length}
              </p>
            </div>
          </div>

          {step === 'validation' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('preview')}>
                {isKeyValue ? 'Назад' : 'Исправить сопоставление'}
              </Button>
              <Button loading={confirmMut.isPending} onClick={() => confirmMut.mutate()}>
                Подтвердить импорт
              </Button>
            </div>
          )}
          {step === 'done' && (
            <div className="space-y-3">
              <p className="text-sm text-emerald-700">Параметры успешно импортированы в проект.</p>
              {importedKeys.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-steel-600">
                    Загружено параметров: {importedKeys.length}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {importedKeys.map((k) => (
                      <li
                        key={k}
                        className="rounded border border-steel-200 bg-steel-50 px-2 py-0.5 text-xs text-steel-800"
                      >
                        {objectParamLabel(k, paramSchema)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
