import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Upload, X } from 'lucide-react'
import { importApi } from '../../api/import'
import { projectsApi } from '../../api/projects'
import { getFriendlyError } from '../../api/client'
import type { ImportPreview, ImportValidateResponse } from '../../types'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Table } from '../ui/Table'
import { Callout } from '../ui/Callout'
import { toastError, toastSuccess } from '../../store/toastStore'
import { objectParamLabel } from '../../utils/labels'
import { importMappedParamHint } from '../../utils/attention'

const TARGET_FIELDS = [
  { value: 'area_m2', label: 'Площадь, м²' },
  { value: 'area_width_m', label: 'Ширина площадки, м' },
  { value: 'area_length_m', label: 'Длина площадки, м' },
  { value: 'aisle_width_mm', label: 'Ширина проходов, мм' },
  { value: 'required_payload_kg', label: 'Грузоподъёмность, кг' },
  { value: 'peak_demand', label: 'Пиковая нагрузка, оп/ч' },
  { value: 'ops_count', label: 'Объём операций / сутки' },
  { value: 'zones_count', label: 'Число зон' },
  { value: 'charging_stations', label: 'Зарядных станций' },
  { value: 'staff_count', label: 'Численность персонала' },
  { value: 'staff_salary_month', label: 'Зарплата, ₽/мес' },
  { value: 'current_labor_cost_year', label: 'Затраты на труд, ₽/год' },
  { value: 'payroll_tax_coef', label: 'Коэффициент начислений на ФОТ' },
  { value: 'shifts_count', label: 'Смен в сутки' },
  { value: 'shift_hours', label: 'Часов в смене' },
  { value: 'temperature_min_c', label: 'Температура мин., °C' },
  { value: 'temperature_max_c', label: 'Температура макс., °C' },
  { value: 'humidity_max_pct', label: 'Влажность макс., %' },
  { value: 'storage_type', label: 'Тип хранения' },
  { value: 'floors_count', label: 'Этажность' },
  { value: 'zone_type', label: 'Тип зоны' },
  { value: 'facility_type', label: 'Тип учреждения' },
  { value: 'ignore', label: 'Не импортировать' },
]

interface ImportFlowProps {
  projectId: string
}

type Step = 'file' | 'preview' | 'validation' | 'done'

type ParamSchema = {
  properties?: Record<string, { title?: string } | undefined>
} | null

function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`
}

export function ImportFlow({ projectId }: ImportFlowProps) {
  const qc = useQueryClient()
  const [step, setStep] = useState<Step>('file')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validation, setValidation] = useState<ImportValidateResponse | null>(null)
  const [importedKeys, setImportedKeys] = useState<string[]>([])
  const [overwrittenKeys, setOverwrittenKeys] = useState<string[]>([])
  const [doneWarnings, setDoneWarnings] = useState<string[]>([])

  const paramsQuery = useQuery({
    queryKey: ['project-params', projectId],
    queryFn: () => projectsApi.getParams(projectId),
  })
  const paramSchema = (paramsQuery.data?.parameter_schema as ParamSchema) || null

  const isKeyValue = preview?.mode === 'key_value'
  const recognizedCount = useMemo(() => {
    if (importedKeys.length) return importedKeys.length
    if (validation?.parsed_params) return Object.keys(validation.parsed_params).filter((k) => !k.startsWith('_')).length
    if (preview?.parsed_params) {
      return Object.keys(preview.parsed_params).filter((k) => !k.startsWith('_')).length
    }
    return 0
  }, [importedKeys, preview, validation])

  const resetAll = () => {
    setStep('file')
    setFile(null)
    setPreview(null)
    setMapping({})
    setValidation(null)
    setImportedKeys([])
    setOverwrittenKeys([])
    setDoneWarnings([])
  }

  const previewMut = useMutation({
    mutationFn: (f: File) => importApi.preview(projectId, f),
    onSuccess: (data) => {
      const normalized: ImportPreview = {
        ...data,
        sample_rows: data.sample_rows ?? (data as { preview?: Record<string, string>[] }).preview ?? [],
        total_rows: data.total_rows ?? (data as { row_count?: number }).row_count ?? 0,
        filename: data.filename ?? file?.name,
        file_size_bytes: data.file_size_bytes ?? file?.size,
      }
      setPreview(normalized)
      const suggested = normalized.suggested_mapping || {}
      const initial: Record<string, string> = {}
      normalized.columns.forEach((c) => {
        initial[c] = suggested[c] || 'ignore'
      })
      setMapping(initial)
      setStep('preview')
      if (normalized.errors?.length) {
        toastError(normalized.errors[0])
      } else {
        toastSuccess('Файл загружен для предварительного просмотра')
      }
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const validateMut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Файл не выбран')
      return importApi.validate(projectId, mapping, file)
    },
    onSuccess: (data) => {
      setValidation(data)
      setStep('validation')
      if (data.valid) toastSuccess('Данные проверены — можно подтвердить импорт')
      else toastError(data.errors?.[0] || 'Есть ошибки валидации')
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const confirmMut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Файл не выбран')
      return importApi.confirm(projectId, mapping, file)
    },
    onSuccess: (data) => {
      const keys = data.updated_keys?.length
        ? data.updated_keys
        : Object.keys(data.object_params || {}).filter((k) => !k.startsWith('_'))
      setImportedKeys(keys)
      setOverwrittenKeys(data.overwritten_keys || [])
      setDoneWarnings((data.warnings || []).map(String))
      setStep('done')
      void paramsQuery.refetch()
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: ['project-params', projectId] })
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
  const unmapped =
    validation?.unmapped_columns?.length
      ? validation.unmapped_columns
      : preview?.ignored_columns || []

  return (
    <div className="space-y-5" data-testid="import-flow">
      <ol className="flex flex-wrap gap-2 text-xs font-medium text-[var(--nc-muted)]">
        {[
          ['file', 'Выбор файла'],
          ['preview', 'Просмотр и сопоставление'],
          ['validation', 'Проверка'],
          ['done', 'Готово'],
        ].map(([id, label]) => (
          <li
            key={id}
            className={`rounded-md px-2.5 py-1 ${
              step === id
                ? 'bg-[var(--nc-accent-soft)] text-[var(--nc-ink)]'
                : 'bg-[var(--nc-surface-muted)] text-[var(--nc-muted)]'
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {step === 'file' && (
        <div className="space-y-4">
          <div className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface)] p-4">
            <p className="font-medium text-[var(--nc-ink)]">1. Скачайте шаблон Excel</p>
            <p className="mt-1 text-sm text-[var(--nc-muted)]">
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

          <div className="rounded border border-dashed border-[var(--nc-border-strong)] bg-[var(--nc-surface-muted)] p-8 text-center">
            <Upload className="mx-auto mb-3 h-8 w-8 text-[var(--nc-faint)]" />
            <p className="font-medium text-[var(--nc-ink)]">2. Загрузите заполненный файл</p>
            <p className="mt-1 text-sm text-[var(--nc-muted)]">
              Excel по шаблону (лист «Параметры») или CSV/Excel с колонками параметров. Максимум 10 МБ.
              Форматы: .xlsx, .xls, .csv. DWG не поддерживается.
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="mx-auto mt-4 block text-sm"
              data-testid="import-file-input"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              aria-label="Выберите файл для импорта"
            />
            {file && (
              <p className="mt-2 text-sm text-[var(--nc-text)]" data-testid="import-file-meta">
                {file.name} · {formatBytes(file.size)} · {file.type || 'тип не указан'}
              </p>
            )}
            <Button
              className="mt-4"
              disabled={!file}
              loading={previewMut.isPending}
              data-testid="import-preview-btn"
              onClick={() => file && previewMut.mutate(file)}
            >
              Загрузить и показать
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <>
          <div className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface)] px-3 py-2 text-sm text-[var(--nc-text)]">
            <p data-testid="import-file-meta">
              Файл: <strong>{preview.filename || file?.name}</strong>
              {(preview.file_size_bytes != null || file?.size != null) && (
                <> · {formatBytes(preview.file_size_bytes ?? file!.size)}</>
              )}
              <> · строк: {preview.total_rows}</>
              {preview.parsed_params && (
                <> · распознано: {Object.keys(preview.parsed_params).filter((k) => !k.startsWith('_')).length}</>
              )}
            </p>
            {isKeyValue && (
              <p className="mt-1 text-[var(--nc-muted)]">
                Формат «Параметр / Значение» — сопоставление колонок не требуется. Неизвестные строки
                не скрываются.
              </p>
            )}
          </div>

          {(preview.warnings?.length || 0) > 0 && (
            <Callout variant="warning" title="Предупреждения при разборе">
              <ul className="list-disc pl-4">
                {preview.warnings!.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Callout>
          )}
          {(preview.errors?.length || 0) > 0 && (
            <Callout variant="danger" title="Ошибки разбора">
              <ul className="list-disc pl-4">
                {preview.errors!.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Callout>
          )}

          {preview.parsed_params && Object.keys(preview.parsed_params).length > 0 && (
            <div className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface-muted)]/50 p-3">
              <p className="mb-2 text-sm font-medium text-[var(--nc-ink)]">Распознанные значения</p>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(preview.parsed_params)
                  .filter(([k]) => !k.startsWith('_'))
                  .slice(0, 24)
                  .map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-2 border-b border-[var(--nc-border-subtle)] py-0.5">
                      <span className="text-[var(--nc-muted)]">{objectParamLabel(k, paramSchema)}</span>
                      <span className="font-mono text-[var(--nc-ink)]">{String(v)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {(preview.unrecognized_labels?.length || 0) > 0 && (
            <Callout variant="info" title="Строки без точного сопоставления с моделью">
              {preview.unrecognized_labels!.slice(0, 15).join(', ')}
              {preview.unrecognized_labels!.length > 15 ? '…' : ''}
            </Callout>
          )}

          <div className="overflow-hidden rounded border border-[var(--nc-border)]">
            <p className="border-b border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-3 py-1.5 text-xs text-[var(--nc-muted)]">
              В таблице — исходные имена колонок файла. Под ними — распознанный параметр NETCORE (если
              сопоставлен).
            </p>
            <Table
              columns={preview.columns.map((c) => {
                const mapped = mapping[c]
                const hint = importMappedParamHint(mapped)
                return {
                  key: c,
                  header: (
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium text-[var(--nc-ink)]">{c}</span>
                      <span className="text-[11px] font-normal normal-case text-[var(--nc-muted)]">
                        {hint
                          ? `→ ${hint}`
                          : mapped === 'ignore'
                            ? '→ не импортировать'
                            : '→ не сопоставлено'}
                      </span>
                    </span>
                  ),
                  render: (row: Record<string, string>) => row[c] ?? '—',
                }
              })}
              rows={sampleRows.map((row, i) => ({ ...row, __i: String(i) }))}
              rowKey={(row) => row.__i}
            />
          </div>

          {!isKeyValue && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--nc-ink)]">Сопоставление столбцов</p>
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
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep('file')}>
              Назад
            </Button>
            <Button variant="ghost" onClick={resetAll} aria-label="Отменить импорт">
              <X className="h-4 w-4" />
              Отменить импорт
            </Button>
            <Button
              loading={validateMut.isPending}
              data-testid="import-validate-btn"
              onClick={() => validateMut.mutate()}
              disabled={(preview.errors?.length || 0) > 0}
            >
              Проверить данные
            </Button>
          </div>
        </>
      )}

      {step === 'validation' && validation && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--nc-border)] bg-[var(--nc-surface)] p-4">
              <p className="text-xs text-[var(--nc-muted)]">Строк в файле</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--nc-ink)]">{validation.row_count}</p>
            </div>
            <div className="rounded-lg border border-[var(--nc-border)] bg-[var(--nc-surface)] p-4">
              <p className="text-xs text-[var(--nc-muted)]">Распознано параметров</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--nc-ink)]">{recognizedCount}</p>
            </div>
            <div className="rounded-lg border border-[var(--nc-border)] bg-[var(--nc-surface)] p-4">
              <p className="text-xs text-[var(--nc-muted)]">Будут перезаписаны</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--nc-ink)]">
                {validation.will_overwrite?.length || 0}
              </p>
            </div>
          </div>

          {(validation.errors?.length || 0) > 0 && (
            <Callout variant="danger" title="Ошибки — импорт нельзя подтвердить">
              <ul className="list-disc pl-4">
                {validation.errors!.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Callout>
          )}
          {(validation.warnings?.length || 0) > 0 && (
            <Callout variant="warning" title="Предупреждения">
              <ul className="list-disc pl-4">
                {validation.warnings!.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Callout>
          )}
          {(validation.will_overwrite?.length || 0) > 0 && (
            <Callout variant="warning" title="Перезапись существующих данных">
              Следующие параметры уже заданы в проекте и будут заменены значениями из файла:{' '}
              {validation.will_overwrite!.map((k) => objectParamLabel(k, paramSchema)).join(', ')}.
              Подтверждение необратимо до ручного восстановления.
            </Callout>
          )}
          {unmapped.length > 0 && (
            <Callout variant="info" title="Столбцы не будут импортированы">
              {unmapped.join(', ')}
            </Callout>
          )}

          {validation.parsed_params && (
            <div className="rounded border border-[var(--nc-border)] p-3">
              <p className="mb-2 text-sm font-medium">Итоговая сводка перед применением</p>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(validation.parsed_params)
                  .filter(([k]) => !k.startsWith('_'))
                  .map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="text-[var(--nc-muted)]">{objectParamLabel(k, paramSchema)}</span>
                      <span className="font-mono">{String(v)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep('preview')}>
              {isKeyValue ? 'Назад' : 'Исправить сопоставление'}
            </Button>
            <Button variant="ghost" onClick={resetAll}>
              Отменить импорт
            </Button>
            <Button
              loading={confirmMut.isPending}
              disabled={!validation.valid}
              data-testid="import-confirm-btn"
              onClick={() => confirmMut.mutate()}
            >
              Подтвердить импорт
            </Button>
          </div>
        </>
      )}

      {step === 'done' && (
        <div className="space-y-3">
          <Callout variant="success" title="Параметры успешно импортированы">
            Данные сохранены в проекте. Можно перейти к проверке полноты и подбору.
          </Callout>
          {importedKeys.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-[var(--nc-muted)]">Обновлено параметров: {importedKeys.length}</p>
              <ul className="flex flex-wrap gap-1.5">
                {importedKeys.map((k) => (
                  <li
                    key={k}
                    className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface-muted)] px-2 py-0.5 text-xs text-[var(--nc-ink)]"
                  >
                    {objectParamLabel(k, paramSchema)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {overwrittenKeys.length > 0 && (
            <Callout variant="info" title="Перезаписаны ранее сохранённые значения">
              {overwrittenKeys.map((k) => objectParamLabel(k, paramSchema)).join(', ')}
            </Callout>
          )}
          {doneWarnings.length > 0 && (
            <Callout variant="warning" title="Допущения и предупреждения импорта">
              <ul className="list-disc pl-4">
                {doneWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Callout>
          )}
          <Button variant="outline" onClick={resetAll}>
            Импортировать другой файл
          </Button>
        </div>
      )}
    </div>
  )
}
