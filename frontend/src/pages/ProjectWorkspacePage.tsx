import { useEffect, useMemo, useState, Fragment } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  GitCompare,
  Play,
} from 'lucide-react'
import { catalogApi } from '../api/catalog'
import { projectsApi } from '../api/projects'
import { economicsApi, matchingApi, visualizationApi } from '../api/economics'
import { compareApi } from '../api/compare'
import { getFriendlyError } from '../api/client'
import type { MatchingResultItem, ProjectParams, Robot } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Pagination } from '../components/ui/Pagination'
import { ObjectParamsForm } from '../components/project/ObjectParamsForm'
import { ImportFlow } from '../components/project/ImportFlow'
import { EconomicsPanel } from '../components/project/EconomicsPanel'
import { FloorPlanVisualization } from '../components/project/FloorPlanVisualization'
import { toastError, toastSuccess } from '../store/toastStore'
import { formatCurrency, formatHours, formatKg, formatMps, formatNumber, formatPercent } from '../utils/format'
import {
  matchStatusIcon,
  matchStatusLabel,
  isMissingDataWarning,
  breakdownLabel,
  dataOriginLabel,
} from '../utils/labels'

const STEPS = [
  { id: 'params', label: 'Параметры' },
  { id: 'import', label: 'Импорт данных' },
  { id: 'selection', label: 'Подбор' },
  { id: 'compare', label: 'Сравнение' },
  { id: 'economics', label: 'Экономика' },
  { id: 'scenarios', label: 'Анализ сценариев' },
  { id: 'visualization', label: 'Визуализация' },
  { id: 'results', label: 'Результаты' },
]

const FILTER_TABS = [
  { id: 'all', label: 'Все' },
  { id: 'suitable', label: 'Подходит' },
  { id: 'needs_review', label: 'Требует проверки' },
  { id: 'excluded', label: 'Не подходит' },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function reasonsList(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return [value]
  return [JSON.stringify(value)]
}

export function ProjectWorkspacePage() {
  const { id = '' } = useParams()
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const step = search.get('step') || 'params'
  const [params, setParams] = useState<ProjectParams>({})
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    try {
      const raw = sessionStorage.getItem(`project_${id}_compare_ids`)
      const parsed = raw ? (JSON.parse(raw) as number[]) : []
      return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(`project_${id}_compare_ids`, JSON.stringify(selectedIds))
    } catch {
      /* ignore */
    }
  }, [id, selectedIds])

  const [scenarioId, setScenarioId] = useState('purchase')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [matchPage, setMatchPage] = useState(1)
  const [matchPageSize, setMatchPageSize] = useState(10)

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id),
    enabled: !!id,
  })

  const objectTypesQuery = useQuery({
    queryKey: ['object-types'],
    queryFn: () => catalogApi.objectTypes(),
  })

  const objectTypeMeta = useMemo(() => {
    const oid = projectQuery.data?.object_type_id
    if (oid == null) return undefined
    return (objectTypesQuery.data || []).find((o) => o.id === oid)
  }, [projectQuery.data, objectTypesQuery.data])

  const paramsQuery = useQuery({
    queryKey: ['project-params', id],
    queryFn: () => projectsApi.getParams(id),
    enabled: !!id,
  })

  useEffect(() => {
    if (paramsQuery.data?.object_params) setParams(paramsQuery.data.object_params)
  }, [paramsQuery.data])

  const saveParamsMut = useMutation({
    mutationFn: () => projectsApi.saveParams(id, params),
    onSuccess: () => {
      toastSuccess('Параметры сохранены')
      qc.invalidateQueries({ queryKey: ['project-params', id] })
      qc.invalidateQueries({ queryKey: ['project', id] })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const selectionQuery = useQuery({
    queryKey: ['matching', id],
    queryFn: () => matchingApi.results(id),
    enabled: !!id && (step === 'selection' || step === 'compare' || step === 'results'),
  })

  const runSelectionMut = useMutation({
    mutationFn: () => matchingApi.run(id),
    onSuccess: (data) => {
      // Гость на демо: результаты только в ответе run (в БД не пишутся).
      // Сразу кладём их в кэш, иначе invalidate → GET /results вернёт пусто.
      qc.setQueryData(['matching', id], data)
      if (!data.read_only) {
        void qc.invalidateQueries({ queryKey: ['matching', id] })
      }
      const suitable = data.suitable ?? data.results?.filter((r) => r.status === 'suitable').length ?? 0
      toastSuccess(
        data.read_only
          ? `Подбор выполнен (просмотр): подходящих ${suitable}`
          : `Подбор выполнен: подходящих ${suitable}`,
      )
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const vizQuery = useQuery({
    queryKey: ['visualization', id],
    queryFn: () => visualizationApi.layout(id),
    enabled: !!id && step === 'visualization',
  })

  const calcQuery = useQuery({
    queryKey: ['calculation', id],
    queryFn: () => visualizationApi.calculation(id),
    enabled: !!id && step === 'visualization',
  })

  const resultsEconomicsQuery = useQuery({
    queryKey: ['results-economics', id],
    queryFn: () => economicsApi.calculate(id, { scenario: 'purchase' }),
    enabled: !!id && step === 'results',
  })

  const results: MatchingResultItem[] = selectionQuery.data?.results || []
  const filteredResults = useMemo(() => {
    if (statusFilter === 'all') return results
    return results.filter((r) => r.status === statusFilter)
  }, [results, statusFilter])

  const compareInlineQuery = useQuery({
    queryKey: ['project-compare', id, selectedIds.join(',')],
    queryFn: () => compareApi.get(selectedIds),
    enabled: !!id && step === 'compare' && selectedIds.length >= 2,
  })

  const selectedNames = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of results) {
      if (r.robot_name) map.set(r.robot_id, r.robot_name)
    }
    for (const r of compareInlineQuery.data?.robots || []) {
      map.set(r.id, r.name)
    }
    return map
  }, [results, compareInlineQuery.data])

  const compareRobots: Robot[] = useMemo(() => {
    const list = compareInlineQuery.data?.robots || []
    const byId = new Map(list.map((r) => [r.id, r]))
    return selectedIds.map((rid) => byId.get(rid)).filter(Boolean) as Robot[]
  }, [compareInlineQuery.data, selectedIds])

  const pagedResults = useMemo(() => {
    const start = (matchPage - 1) * matchPageSize
    return filteredResults.slice(start, start + matchPageSize)
  }, [filteredResults, matchPage, matchPageSize])

  useEffect(() => {
    setMatchPage(1)
  }, [statusFilter, results.length])

  const onStatusFilterChange = (id: string) => {
    setStatusFilter(id)
    setMatchPage(1)
  }
  const paramSchema =
    (objectTypeMeta?.parameter_schema as { properties?: Record<string, { type?: string; title?: string; enum?: string[] }> } | null) ||
    (paramsQuery.data?.parameter_schema as { properties?: Record<string, { type?: string; title?: string; enum?: string[] }> } | null) ||
    null

  const setStep = (s: string) => {
    setSearch({ step: s })
  }

  if (projectQuery.isLoading) return <SkeletonRows rows={8} />
  if (projectQuery.isError) {
    return <p className="text-sm text-red-600">{getFriendlyError(projectQuery.error)}</p>
  }

  const project = projectQuery.data!
  const econ = resultsEconomicsQuery.data?.results

  return (
    <div>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {project.name}
            {project.is_demo && (
              <Badge
                variant="warning"
                title="Демонстрационные данные используются для показа возможностей платформы"
              >
                Демонстрационный проект
              </Badge>
            )}
          </span>
        }
        subtitle={`${objectTypeMeta?.name_ru || 'Проект'}${
          project.description ? ` — ${project.description}` : ''
        }`}
        crumbs={[
          { label: 'Панель управления', to: '/app' },
          { label: 'Мои проекты', to: '/app/projects' },
          { label: project.name },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  toastSuccess('Формирование отчёта…')
                  const blob = await projectsApi.exportPdf(id)
                  downloadBlob(blob, `${project.name}.pdf`)
                  toastSuccess('Отчёт успешно сформирован')
                } catch (e) {
                  toastError(
                    getFriendlyError(e) ||
                      'Не удалось сформировать отчёт. Попробуйте ещё раз.',
                  )
                }
              }}
            >
              <FileText className="h-4 w-4" />
              Экспорт PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  toastSuccess('Формирование отчёта…')
                  const blob = await projectsApi.exportExcel(id)
                  downloadBlob(blob, `${project.name}.xlsx`)
                  toastSuccess('Отчёт успешно сформирован')
                } catch (e) {
                  toastError(
                    getFriendlyError(e) ||
                      'Не удалось сформировать отчёт. Попробуйте ещё раз.',
                  )
                }
              }}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Экспорт Excel
            </Button>
          </>
        }
      />

      <Tabs items={STEPS} value={step} onChange={setStep} className="mb-5" />

      {step === 'params' && (
        <Card
          title="Параметры объекта"
          actions={
            <Button loading={saveParamsMut.isPending} onClick={() => saveParamsMut.mutate()}>
              Сохранить
            </Button>
          }
        >
          {paramsQuery.isLoading ? (
            <SkeletonRows />
          ) : paramsQuery.isError ? (
            <p className="text-sm text-red-600">{getFriendlyError(paramsQuery.error)}</p>
          ) : (
            <ObjectParamsForm
              objectType={objectTypeMeta?.code || 'warehouse'}
              values={params}
              onChange={setParams}
              schema={paramSchema}
            />
          )}
        </Card>
      )}

      {step === 'import' && (
        <Card title="Импорт параметров объекта" subtitle="Скачайте Excel-шаблон, заполните жёлтую колонку и загрузите файл">
          <ImportFlow projectId={id} />
        </Card>
      )}

      {step === 'selection' && (
        <Card
          title="Подбор решений"
          actions={
            <Button loading={runSelectionMut.isPending} onClick={() => runSelectionMut.mutate()}>
              <Play className="h-4 w-4" />
              Запустить подбор
            </Button>
          }
        >
          {selectionQuery.isLoading && <SkeletonRows />}
          {selectionQuery.isError && (
            <p className="text-sm text-red-600">{getFriendlyError(selectionQuery.error)}</p>
          )}
          {!selectionQuery.isLoading && results.length === 0 && (
            <EmptyState
              title="Результаты подбора отсутствуют"
              description="Запустите подбор после заполнения параметров и импорта данных."
              actionLabel="Запустить подбор"
              onAction={() => runSelectionMut.mutate()}
            />
          )}
          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Tabs items={FILTER_TABS} value={statusFilter} onChange={onStatusFilterChange} />
                <p className="text-sm text-steel-500">
                  В фильтре: {filteredResults.length} из {results.length}
                </p>
              </div>
              <div className="overflow-hidden rounded border border-steel-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-steel-50 text-xs uppercase text-steel-500">
                      <tr>
                        <th className="px-3 py-2" />
                        <th className="px-3 py-2">Выбор</th>
                        <th className="px-3 py-2">Название</th>
                        <th className="px-3 py-2">Грузоподъёмность</th>
                        <th className="px-3 py-2">Цена</th>
                        <th className="px-3 py-2">Статус</th>
                        <th className="px-3 py-2">Оценка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedResults.map((r) => {
                      const rowKey = r.id ?? r.robot_id
                      const open = expandedId === rowKey
                      const matches = reasonsList(r.match_reasons)
                      const exclusions = reasonsList(r.exclusion_reasons)
                      return (
                        <Fragment key={rowKey}>
                          <tr className="border-t border-steel-100 hover:bg-steel-50/80">
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                className="rounded p-1 text-steel-500 hover:bg-steel-100"
                                aria-label="Показать причины"
                                onClick={() => setExpandedId(open ? null : rowKey)}
                              >
                                {open ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(r.robot_id)}
                                onChange={(e) =>
                                  setSelectedIds((ids) =>
                                    e.target.checked
                                      ? [...ids, r.robot_id]
                                      : ids.filter((x) => x !== r.robot_id),
                                  )
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                className="text-left font-medium text-brand-800 hover:underline"
                                onClick={() => navigate(`/app/catalog/${r.robot_id}`)}
                              >
                                {r.robot_name || `#${r.robot_id}`}
                              </button>
                            </td>
                            <td className="px-3 py-2">{formatKg(r.robot_payload_kg)}</td>
                            <td className="px-3 py-2">{formatCurrency(r.robot_price_rub)}</td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  r.status === 'suitable'
                                    ? 'success'
                                    : r.status === 'excluded'
                                      ? 'danger'
                                      : 'warning'
                                }
                              >
                                <span className="mr-1" aria-hidden>
                                  {matchStatusIcon(r.status)}
                                </span>
                                {matchStatusLabel(r.status)}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              {r.match_score != null ? (
                                <Badge variant="info">{formatNumber(r.match_score, 1)}</Badge>
                              ) : (
                                'Нет данных'
                              )}
                            </td>
                          </tr>
                          {open && (
                            <tr className="border-t border-steel-100 bg-steel-50/60">
                              <td colSpan={7} className="px-4 py-3">
                                {(() => {
                                  const warnings = [...matches, ...exclusions].filter((m) =>
                                    isMissingDataWarning(m),
                                  )
                                  const matchOnly = matches.filter((m) => !isMissingDataWarning(m))
                                  const exclOnly = exclusions.filter((m) => !isMissingDataWarning(m))
                                  return (
                                    <div className="space-y-4">
                                      {warnings.length > 0 && (
                                        <div
                                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2"
                                          role="status"
                                        >
                                          <p className="mb-1 text-xs font-semibold uppercase text-amber-800">
                                            Недостаток данных в каталоге (ТТХ)
                                          </p>
                                          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                                            {warnings.map((m) => (
                                              <li key={m}>
                                                <span className="mr-1" aria-hidden>
                                                  ⚠
                                                </span>
                                                {m.replace(/^⚠\s*/, '')}
                                              </li>
                                            ))}
                                          </ul>
                                          <p className="mt-2 text-xs text-amber-700">
                                            В исходном CSV часто нет полных ТТХ (скорость, навигация и
                                            т.п.) — статус «Требует проверки».
                                          </p>
                                        </div>
                                      )}
                                      <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                          <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">
                                            Причины соответствия
                                          </p>
                                          {matchOnly.length ? (
                                            <ul className="list-disc space-y-1 pl-5 text-sm text-steel-700">
                                              {matchOnly.map((m) => (
                                                <li key={m}>
                                                  <span className="text-emerald-600">✓</span> {m}
                                                </li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <p className="text-sm text-steel-500">Нет данных</p>
                                          )}
                                        </div>
                                        <div>
                                          <p className="mb-1 text-xs font-semibold uppercase text-red-700">
                                            Причины исключения / замечания
                                          </p>
                                          {exclOnly.length ? (
                                            <ul className="list-disc space-y-1 pl-5 text-sm text-steel-700">
                                              {exclOnly.map((m) => (
                                                <li key={m}>
                                                  <span className="text-red-600">✕</span> {m}
                                                </li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <p className="text-sm text-steel-500">Нет замечаний</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })()}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                    </tbody>
                  </table>
                </div>
                {filteredResults.length > 0 && (
                  <Pagination
                    page={matchPage}
                    pageSize={matchPageSize}
                    total={filteredResults.length}
                    pageSizeOptions={[10, 20, 50]}
                    onPageChange={setMatchPage}
                    onPageSizeChange={(s) => {
                      setMatchPageSize(s)
                      setMatchPage(1)
                    }}
                  />
                )}
              </div>
              {filteredResults.length === 0 && (
                <p className="text-sm text-steel-500">Нет решений в выбранном фильтре.</p>
              )}
              {selectedIds.length > 0 && (
                <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 shadow-panel">
                  <p className="text-sm text-steel-800">
                    Выбрано для сравнения: <strong>{selectedIds.length}</strong>
                    {selectedIds.length < 2 && ' (нужно минимум 2)'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedIds.length < 2}
                      onClick={() => setStep('compare')}
                    >
                      <GitCompare className="h-4 w-4" />
                      К сравнению
                    </Button>
                    <Button size="sm" onClick={() => setStep('economics')}>
                      Далее: экономика
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {step === 'compare' && (
        <Card
          title="Сравнение выбранных решений"
          subtitle="Сравнение внутри проекта — без ухода на отдельную страницу"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep('selection')}>
                Изменить выбор
              </Button>
              <Button onClick={() => setStep('economics')}>Далее: экономика</Button>
            </div>
          }
        >
          {selectedIds.length < 2 ? (
            <EmptyState
              title="Выберите не менее двух роботов"
              description="Отметьте решения галочками на шаге «Подбор», затем вернитесь сюда."
              actionLabel="К подбору"
              onAction={() => setStep('selection')}
            />
          ) : (
            <div className="space-y-4">
              <ul className="flex flex-wrap gap-2">
                {selectedIds.map((rid) => (
                  <li
                    key={rid}
                    className="inline-flex items-center gap-2 rounded border border-steel-200 bg-steel-50 px-2.5 py-1 text-sm"
                  >
                    {selectedNames.get(rid) || `#${rid}`}
                    <button
                      type="button"
                      className="text-steel-400 hover:text-steel-800"
                      aria-label="Убрать из сравнения"
                      onClick={() => setSelectedIds((ids) => ids.filter((x) => x !== rid))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              {compareInlineQuery.isLoading && <SkeletonRows rows={6} />}
              {compareInlineQuery.isError && (
                <p className="text-sm text-red-600">{getFriendlyError(compareInlineQuery.error)}</p>
              )}
              {compareRobots.length >= 2 && (
                <div className="overflow-x-auto rounded border border-steel-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-steel-200 bg-steel-50">
                        <th className="px-3 py-2 text-left font-medium text-steel-600">Параметр</th>
                        {compareRobots.map((r) => (
                          <th key={r.id} className="min-w-[140px] px-3 py-2 text-left font-medium">
                            {r.name}
                            <div className="mt-0.5 text-xs font-normal text-steel-500">
                              {dataOriginLabel(r.data_origin)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['Назначение', (r: Robot) => r.purpose || 'Нет данных'],
                          ['Страна', (r: Robot) => r.country || 'Нет данных'],
                          ['Грузоподъёмность', (r: Robot) => formatKg(r.payload_kg)],
                          ['Скорость', (r: Robot) => formatMps(r.speed_mps)],
                          ['Автономность', (r: Robot) => formatHours(r.autonomy_hours)],
                          ['Цена', (r: Robot) => formatCurrency(r.price_rub)],
                          [
                            'Производительность',
                            (r: Robot) =>
                              r.productivity_ops_per_hour != null
                                ? `${formatNumber(r.productivity_ops_per_hour)} оп/ч`
                                : 'Нет данных',
                          ],
                        ] as const
                      ).map(([label, getter]) => (
                        <tr key={label} className="border-t border-steel-100">
                          <td className="px-3 py-2 text-steel-500">{label}</td>
                          {compareRobots.map((r) => (
                            <td key={`${label}-${r.id}`} className="px-3 py-2 text-steel-800">
                              {getter(r)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded border border-steel-200 bg-steel-50 px-4 py-3 text-sm text-steel-700">
                <p className="font-medium text-steel-900">Что дальше</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>
                    <button type="button" className="text-brand-700 hover:underline" onClick={() => setStep('economics')}>
                      Экономика
                    </button>{' '}
                    — CAPEX/OPEX для выбранного сценария покупки
                  </li>
                  <li>
                    <button type="button" className="text-brand-700 hover:underline" onClick={() => setStep('scenarios')}>
                      Анализ сценариев
                    </button>{' '}
                    — сравнение «без роботов / покупка / RaaS»
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-brand-700 hover:underline"
                      onClick={() => setStep('visualization')}
                    >
                      Визуализация
                    </button>{' '}
                    →{' '}
                    <button type="button" className="text-brand-700 hover:underline" onClick={() => setStep('results')}>
                      Результаты
                    </button>{' '}
                    → экспорт PDF/Excel
                  </li>
                </ol>
              </div>
            </div>
          )}
        </Card>
      )}

      {step === 'economics' && <EconomicsPanel projectId={id} mode="economics" />}

      {step === 'scenarios' && <EconomicsPanel projectId={id} mode="scenarios" />}

      {step === 'visualization' && (
        <Card
          title="Демонстрационная симуляция склада"
          subtitle="Единая симуляция в режимах 2D, изометрия и 3D"
        >
          {vizQuery.isLoading || calcQuery.isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : vizQuery.isError || calcQuery.isError ? (
            <p className="text-sm text-red-600">
              {getFriendlyError(vizQuery.error || calcQuery.error)}
            </p>
          ) : vizQuery.data && calcQuery.data ? (
            <FloorPlanVisualization
              layout={vizQuery.data}
              calculation={calcQuery.data}
              scenarioId={scenarioId}
              onScenarioChange={setScenarioId}
              scenarios={[
                { id: 'baseline', label: 'Без роботизации' },
                { id: 'purchase', label: 'Покупка оборудования' },
                { id: 'raas', label: 'Роботы как услуга' },
              ]}
            />
          ) : (
            <EmptyState
              title="Данные визуализации недоступны"
              description="Выполните экономический расчёт, чтобы получить количество роботов для демонстрационной схемы."
              actionLabel="Перейти к экономике"
              onAction={() => setSearch({ step: 'economics' })}
            />
          )}
        </Card>
      )}

      {step === 'results' && (
        <Card title="Итоговые результаты" subtitle="Сводка по проекту · полная детализация в PDF/Excel">
          {resultsEconomicsQuery.isLoading && <SkeletonRows rows={4} />}
          {resultsEconomicsQuery.isError && (
            <p className="text-sm text-red-600">{getFriendlyError(resultsEconomicsQuery.error)}</p>
          )}
          {!resultsEconomicsQuery.isLoading && !resultsEconomicsQuery.isError && !econ && (
            <EmptyState
              title="Результаты ещё не рассчитаны"
              description="Перейдите к экономике и выполните расчёт сценариев."
              actionLabel="Открыть экономику"
              onAction={() => setSearch({ step: 'economics' })}
            />
          )}
          {econ && (
            <div className="space-y-5">
              <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Результат — <strong>предварительная оценка</strong> и требует верификации при
                обследовании объекта. Демонстрационные данные не заменяют исходные материалы.
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-steel-800">
                  Экономика (сценарий «Покупка»)
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ResultKpi title="Роботы" value={formatNumber(econ.robots_count)} />
                  <ResultKpi title="CAPEX" value={formatCurrency(econ.capex?.capex)} />
                  <ResultKpi title="OPEX / год" value={formatCurrency(econ.opex?.opex_annual)} />
                  <ResultKpi
                    title="Годовой эффект"
                    value={formatCurrency(econ.annual_effect?.annual_effect)}
                  />
                  <ResultKpi
                    title="Окупаемость"
                    value={
                      econ.payback?.payback_years != null
                        ? `${formatNumber(econ.payback.payback_years, 1)} лет`
                        : 'Недостаточно данных для расчёта'
                    }
                  />
                  <ResultKpi
                    title="ROI"
                    value={
                      econ.roi?.roi_percent != null
                        ? formatPercent(Number(econ.roi.roi_percent))
                        : 'Недостаточно данных для расчёта'
                    }
                  />
                  <ResultKpi title="TCO" value={formatCurrency(econ.tco?.tco)} />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded border border-steel-200 bg-white p-4">
                  <h3 className="mb-2 text-sm font-semibold text-steel-800">Состав CAPEX</h3>
                  <dl className="space-y-1.5 text-sm">
                    {Object.entries(econ.capex?.breakdown || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-steel-50 py-1">
                        <dt className="text-steel-500">{breakdownLabel(k)}</dt>
                        <dd className="font-medium">
                          {typeof v === 'number' ? formatCurrency(v) : String(v)}
                        </dd>
                      </div>
                    ))}
                    {!Object.keys(econ.capex?.breakdown || {}).length && (
                      <p className="text-steel-500">Нет разбивки</p>
                    )}
                  </dl>
                </div>
                <div className="rounded border border-steel-200 bg-white p-4">
                  <h3 className="mb-2 text-sm font-semibold text-steel-800">Состав OPEX / год</h3>
                  <dl className="space-y-1.5 text-sm">
                    {Object.entries(econ.opex?.breakdown || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-steel-50 py-1">
                        <dt className="text-steel-500">{breakdownLabel(k)}</dt>
                        <dd className="font-medium">
                          {typeof v === 'number' ? formatCurrency(v) : String(v)}
                        </dd>
                      </div>
                    ))}
                    {!Object.keys(econ.opex?.breakdown || {}).length && (
                      <p className="text-steel-500">Нет разбивки</p>
                    )}
                  </dl>
                </div>
              </div>

              <div className="rounded border border-steel-200 bg-white p-4 text-sm text-steel-700">
                <h3 className="mb-2 font-semibold text-steel-800">Краткое заключение</h3>
                <p>
                  {econ.payback?.payback_years == null
                    ? 'При текущих допущениях окупаемость не определена (годовой эффект ≤ 0 или недостаточно данных). Скорректируйте параметры на вкладке «Анализ сценариев».'
                    : econ.payback.payback_years <= 3
                      ? `Ориентировочная окупаемость около ${formatNumber(econ.payback.payback_years, 1)} лет — в зоне привлекательной предынвестиционной гипотезы (до 3 лет).`
                      : econ.payback.payback_years <= 5
                        ? `Ориентировочная окупаемость около ${formatNumber(econ.payback.payback_years, 1)} лет — умеренный горизонт (3–5 лет). Рекомендуется проверить чувствительность к цене и спросу.`
                        : `Ориентировочная окупаемость около ${formatNumber(econ.payback.payback_years, 1)} лет (более 5 лет). Имеет смысл сравнить RaaS и уточнить допущения по труду и производительности.`}
                </p>
                {results.length > 0 && (
                  <p className="mt-2">
                    Подбор: рассмотрено {results.length}, подходит{' '}
                    {results.filter((r) => r.status === 'suitable').length}, требует проверки{' '}
                    {results.filter((r) => r.status === 'needs_review').length}, не подходит{' '}
                    {results.filter((r) => r.status === 'excluded').length}.
                  </p>
                )}
              </div>

              <p className="text-sm text-steel-600">
                В <strong>PDF</strong> и <strong>Excel</strong>: параметры объекта, подобранные
                решения, экономика с формулами, сценарии, допущения и источники. Кнопки экспорта — в
                шапке страницы.
              </p>

              <div className="flex flex-wrap gap-2">
                <Link to={`/app/projects/${id}?step=economics`}>
                  <Button variant="outline">К экономике</Button>
                </Link>
                <Link to={`/app/projects/${id}?step=scenarios`}>
                  <Button variant="outline">К сценариям</Button>
                </Link>
                <Link to={`/app/projects/${id}?step=visualization`}>
                  <Button variant="outline">К визуализации</Button>
                </Link>
                <Link to="/app/projects">
                  <Button variant="secondary">К списку проектов</Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function ResultKpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded border border-steel-200 bg-white p-4 shadow-panel">
      <p className="text-xs text-steel-500">{title}</p>
      <p className="mt-1 font-display text-xl font-semibold text-steel-900">{value}</p>
    </div>
  )
}
