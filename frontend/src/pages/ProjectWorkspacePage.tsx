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
import {
  ECONOMICS_FRESHNESS_LABEL,
  resolveEconomicsFreshness,
} from '../utils/economicsFreshness'
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
import { DataCompletenessPanel, buildCompleteness } from '../components/project/DataCompletenessPanel'
import { AttentionPanel } from '../components/project/AttentionPanel'
import { RequiredInputsBanner } from '../components/project/RequiredInputsBanner'
import {
  assessEconomicsLocal,
  hasArea,
  type CapabilityReadiness,
} from '../utils/requiredInputs'
import { Disclosure } from '../components/ui/Disclosure'
import { UnsavedChangesGuard } from '../components/project/UnsavedChangesGuard'
import { buildAttentionItems } from '../utils/attention'
import { suggestNextStep } from '../utils/nextStep'
import { Callout } from '../components/ui/Callout'
import { ImportFlow } from '../components/project/ImportFlow'
import { EconomicsPanel } from '../components/project/EconomicsPanel'
import { FloorPlanVisualization } from '../components/project/FloorPlanVisualization'
import { WarehouseLayoutEditor } from '../components/project/WarehouseLayoutEditor'
import { FleetComparePanel } from '../components/project/FleetComparePanel'
import { PresentationPanel } from '../components/project/PresentationPanel'
import {
  ProjectStageNav,
  defaultStepForStage,
  resolveProductStage,
  type StageId,
  type StageStatus,
} from '../components/project/ProjectStageNav'
import { toastError, toastSuccess } from '../store/toastStore'
import { useAuthStore } from '../store/authStore'
import {
  formatBreakdownValue,
  formatCurrency,
  formatHours,
  formatKg,
  formatMps,
  formatNumber,
  formatPayback,
  formatPercent,
} from '../utils/format'
import {
  matchStatusIcon,
  matchStatusLabel,
  isMissingDataWarning,
  breakdownLabel,
  dataOriginLabel,
  metricLabel,
} from '../utils/labels'

/** Подвкладки внутри продуктовых этапов (старые ?step= сохраняют совместимость). */
const OBJECT_SUB = [
  { id: 'object', label: 'Параметры' },
  { id: 'import', label: 'Импорт Excel' },
]
const ECON_SUB = [
  { id: 'economics', label: 'Покупка и затраты' },
  { id: 'scenarios', label: 'Сценарии и «что если»' },
  { id: 'fleet', label: 'Сравнение парка' },
]
const REPORT_SUB = [
  { id: 'report', label: 'Итог для руководства' },
  { id: 'results', label: 'Сводка расчёта' },
]

const FILTER_TABS = [
  { id: 'all', label: 'Все' },
  { id: 'suitable', label: 'Предварительно подходит' },
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
  const isGuest = useAuthStore((s) => s.isGuest)
  const rawStep = search.get('step') || 'params'
  // «presentation» — устаревший синоним итога для руководства
  const step = rawStep === 'presentation' ? 'report' : rawStep
  const [params, setParams] = useState<ProjectParams>({})

  useEffect(() => {
    if (rawStep === 'presentation') {
      setSearch({ step: 'report' }, { replace: true })
    }
  }, [rawStep, setSearch])
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
  /** Число роботов для симуляции; null = взять из последнего расчёта */
  const [simRobotsCount, setSimRobotsCount] = useState<number | null>(null)
  const [focusParamKey, setFocusParamKey] = useState<string | null>(null)
  const [paramsCompact, setParamsCompact] = useState(true)
  const [paramFieldErrors, setParamFieldErrors] = useState<Record<string, string>>({})

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

  const paramsDirty = useMemo(() => {
    const saved = paramsQuery.data?.object_params
    if (!saved) return false
    try {
      return JSON.stringify(saved) !== JSON.stringify(params)
    } catch {
      return true
    }
  }, [params, paramsQuery.data])

  const saveParamsMut = useMutation({
    mutationFn: () => projectsApi.saveParams(id, params),
    onSuccess: () => {
      toastSuccess('Параметры сохранены')
      setParamFieldErrors({})
      qc.invalidateQueries({ queryKey: ['project-params', id] })
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['economics-freshness', id] })
      qc.invalidateQueries({ queryKey: ['inputs-readiness', id] })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const freshnessQuery = useQuery({
    queryKey: ['economics-freshness', id],
    queryFn: () => economicsApi.freshness(id),
    enabled: !!id,
    staleTime: 15_000,
  })

  const readinessQuery = useQuery({
    queryKey: ['inputs-readiness', id],
    queryFn: () => projectsApi.inputsReadiness(id),
    enabled: !!id,
    staleTime: 15_000,
  })

  const selectionQuery = useQuery({
    queryKey: ['matching', id],
    queryFn: () => matchingApi.results(id),
    enabled:
      !!id &&
      (step === 'selection' ||
        step === 'compare' ||
        step === 'results' ||
        step === 'report'),
  })

  const runSelectionMut = useMutation({
    mutationFn: () => matchingApi.run(id),
    onSuccess: (data) => {
      // Гость: результаты только в ответе run (в БД не пишутся) — не invalidate,
      // иначе GET /results вернёт пусто и затрёт кэш.
      qc.setQueryData(['matching', id], data)
      if (!data.read_only) {
        void qc.invalidateQueries({ queryKey: ['matching', id] })
        void qc.invalidateQueries({ queryKey: ['project', id] })
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

  const selectForEconMut = useMutation({
    mutationFn: (robotId: number) => matchingApi.selectForEconomics(id, robotId),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['matching', id] })
      void qc.invalidateQueries({ queryKey: ['project', id] })
      toastSuccess(
        data.robot_name
          ? `«${data.robot_name}» выбрано для расчёта. Перейдите в экономику и пересчитайте.`
          : data.message || 'Решение выбрано для расчёта',
      )
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const vizQuery = useQuery({
    queryKey: ['visualization', id, simRobotsCount],
    queryFn: () =>
      visualizationApi.layout(
        id,
        simRobotsCount != null ? { robots_count: simRobotsCount } : undefined,
      ),
    enabled: !!id && step === 'visualization',
  })

  const calcQuery = useQuery({
    queryKey: ['calculation', id, simRobotsCount],
    queryFn: () =>
      visualizationApi.calculation(
        id,
        simRobotsCount != null ? { robots_count: simRobotsCount } : undefined,
      ),
    enabled: !!id && step === 'visualization',
  })

  /** Число роботов из последнего экономического расчёта (источник истины для CAPEX/OPEX) */
  const econRobotsQuery = useQuery({
    queryKey: ['econ-robots-for-sim', id],
    queryFn: async () => {
      const res = await economicsApi.calculate(id, { scenario: 'purchase' })
      return res.results.robots_count
    },
    enabled:
      !!id &&
      step === 'visualization' &&
      Boolean(
        (readinessQuery.data as { summary?: { economics_ready?: boolean } } | undefined)?.summary
          ?.economics_ready,
      ),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (step !== 'visualization') return
    if (simRobotsCount != null) return
    const fromEcon = econRobotsQuery.data
    const fromCalc = calcQuery.data?.robot_count
    if (fromEcon != null) setSimRobotsCount(fromEcon)
    else if (fromCalc != null) setSimRobotsCount(fromCalc)
  }, [step, simRobotsCount, econRobotsQuery.data, calcQuery.data?.robot_count])

  const resultsEconomicsQuery = useQuery({
    queryKey: ['results-economics', id],
    queryFn: () => economicsApi.calculate(id, { scenario: 'purchase' }),
    enabled:
      !!id &&
      (step === 'results' || step === 'report') &&
      Boolean(
        (readinessQuery.data as { summary?: { economics_ready?: boolean } } | undefined)?.summary
          ?.economics_ready,
      ),
  })

  const results: MatchingResultItem[] = selectionQuery.data?.results || []
  const economicsRobotId = useMemo(() => {
    const fromParams = (projectQuery.data?.object_params as ProjectParams | undefined)
      ?.economics_robot_id
    if (fromParams != null && fromParams !== '') {
      const n = Number(fromParams)
      if (!Number.isNaN(n) && n > 0) return n
    }
    const selected = results.find((r) => r.selected)
    return selected?.robot_id ?? null
  }, [projectQuery.data?.object_params, results])
  const economicsRobot = useMemo(
    () => (economicsRobotId != null ? results.find((r) => r.robot_id === economicsRobotId) : null),
    [economicsRobotId, results],
  )
  const economicsRobotPrice = useMemo(() => {
    const fromResult = Number(
      (economicsRobot as { price_rub?: number } | null | undefined)?.price_rub,
    )
    if (Number.isFinite(fromResult) && fromResult > 0) return fromResult
    const summaryPrice = Number(
      (projectQuery.data?.summary as { unit_price?: number } | undefined)?.unit_price,
    )
    if (Number.isFinite(summaryPrice) && summaryPrice > 0) return summaryPrice
    return null
  }, [economicsRobot, projectQuery.data?.summary])

  const economicsReadinessLocal: CapabilityReadiness = useMemo(
    () =>
      assessEconomicsLocal(params, {
        robotPrice: economicsRobotPrice,
        hasSelectedRobot: economicsRobotId != null,
      }),
    [params, economicsRobotPrice, economicsRobotId],
  )

  const capabilitySummary = useMemo(() => {
    const remote = readinessQuery.data as
      | {
          summary?: {
            matching_ready?: boolean
            layout_ready?: boolean
            des_ready?: boolean
            report_ready?: boolean
          }
        }
      | undefined
    const hasLayout = Boolean(projectQuery.data?.layout?.objects?.length)
    const hasEcon = projectQuery.data?.summary?.capex != null
    return {
      matching_ready: remote?.summary?.matching_ready ?? true,
      layout_ready: remote?.summary?.layout_ready ?? (hasArea(params) || hasLayout),
      des_ready: remote?.summary?.des_ready ?? (hasEcon && (hasArea(params) || hasLayout)),
      report_ready: remote?.summary?.report_ready ?? hasEcon,
    }
  }, [readinessQuery.data, projectQuery.data, params])
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

  const productStage = resolveProductStage(step)
  const goStage = (stage: StageId) => setStep(defaultStepForStage(stage))

  const econFreshness = useMemo(
    () =>
      resolveEconomicsFreshness(freshnessQuery.data?.status, {
        paramsDirty,
        hasStoredResult: projectQuery.data?.summary?.capex != null,
      }),
    [freshnessQuery.data?.status, paramsDirty, projectQuery.data?.summary?.capex],
  )

  const stageStatuses = useMemo(() => {
    const paramKeys = Object.keys(params || {}).filter((k) => !k.startsWith('_'))
    const hasParams = paramKeys.length >= 3
    const hasMatch = results.length > 0
    const hasEcon = projectQuery.data?.summary?.capex != null
    const hasLayout = Boolean(projectQuery.data?.layout?.objects?.length)
    let economicsStatus: StageStatus = 'needs_data'
    if (econFreshness === 'fresh') {
      economicsStatus = 'done'
    } else if (econFreshness === 'stale') {
      economicsStatus = 'warning'
    } else if (hasMatch || hasParams) {
      // Не помечаем «готово» только из-за сохранённого CAPEX без проверки freshness.
      economicsStatus = 'ready'
    }
    const st: Partial<Record<StageId, StageStatus>> = {
      object: hasParams ? 'done' : 'needs_data',
      layout: hasLayout ? 'done' : 'ready',
      selection: hasMatch ? 'done' : hasParams ? 'ready' : 'needs_data',
      compare: selectedIds.length >= 2 ? 'done' : hasMatch ? 'ready' : 'idle',
      economics: economicsStatus,
      visualization: hasLayout || hasEcon ? 'ready' : 'idle',
      report: econFreshness === 'fresh' ? 'ready' : hasEcon ? 'warning' : 'idle',
    }
    if (hasMatch && results.some((r) => (r.missing_checks?.length || 0) > 0)) {
      st.selection = 'warning'
    }
    return st
  }, [params, results, selectedIds.length, projectQuery.data, econFreshness])

  const nextStep = useMemo(() => suggestNextStep(stageStatuses), [stageStatuses])

  const attentionItems = useMemo(() => {
    const missingChecks = results.reduce((n, r) => n + (r.missing_checks?.length || 0), 0)
    return buildAttentionItems({
      params,
      missingChecksCount: missingChecks > 0 ? missingChecks : undefined,
    })
  }, [params, results])

  const completenessLine = useMemo(() => {
    const items = buildCompleteness(params)
    const filled = items.filter((i) => i.kind === 'filled').length
    const missing = items.filter((i) => i.kind === 'missing').length
    const assumptions = items.filter((i) => i.kind === 'assumption').length
    return `Исходные данные: заполнено ${filled}, отсутствует ${missing}, допущений ${assumptions}`
  }, [params])

  if (projectQuery.isLoading) return <SkeletonRows rows={8} />
  if (projectQuery.isError) {
    return <p className="text-sm text-red-600">{getFriendlyError(projectQuery.error)}</p>
  }

  const project = projectQuery.data!
  const econ = resultsEconomicsQuery.data?.results
  // Демо общие — только просмотр; свои проекты (в т.ч. гостевые) редактируются
  const readOnly = Boolean(project.is_demo)

  return (
    <div>
      {!readOnly && (
        <UnsavedChangesGuard
          when={paramsDirty}
          onSaveAndLeave={async () => {
            await saveParamsMut.mutateAsync()
          }}
          onDiscard={() => {
            if (paramsQuery.data?.object_params) {
              setParams(paramsQuery.data.object_params)
            }
          }}
        />
      )}
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {project.name}
            {project.is_demo && (
              <Badge
                variant="warning"
                title="Демонстрационные данные используются для показа возможностей платформы"
              >
                Демо
              </Badge>
            )}
          </span>
        }
        subtitle={objectTypeMeta?.name_ru || 'Проект'}
        crumbs={[
          { label: 'Обзор', to: '/app' },
          { label: 'Проекты', to: '/app/projects' },
          { label: project.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setStep(nextStep.step)}>
              {nextStep.ctaLabel}
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label="Скачать PDF"
              disabled={econFreshness !== 'fresh'}
              title={
                econFreshness === 'stale'
                  ? 'Экономика устарела — пересчитайте перед экспортом'
                  : econFreshness !== 'fresh'
                    ? 'Сначала выполните расчёт экономики'
                    : undefined
              }
              onClick={async () => {
                if (econFreshness !== 'fresh') {
                  toastError(
                    econFreshness === 'stale'
                      ? 'Экономика устарела — пересчитайте перед экспортом'
                      : 'Сначала выполните расчёт экономики',
                  )
                  return
                }
                try {
                  const blob = await projectsApi.exportPdf(id)
                  downloadBlob(blob, `${project.name}.pdf`)
                  toastSuccess('PDF сформирован')
                } catch (e) {
                  toastError(getFriendlyError(e) || 'Не удалось сформировать PDF')
                }
              }}
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label="Скачать Excel"
              disabled={econFreshness !== 'fresh'}
              title={
                econFreshness === 'stale'
                  ? 'Экономика устарела — пересчитайте перед экспортом'
                  : econFreshness !== 'fresh'
                    ? 'Сначала выполните расчёт экономики'
                    : undefined
              }
              onClick={async () => {
                if (econFreshness !== 'fresh') {
                  toastError(
                    econFreshness === 'stale'
                      ? 'Экономика устарела — пересчитайте перед экспортом'
                      : 'Сначала выполните расчёт экономики',
                  )
                  return
                }
                try {
                  const blob = await projectsApi.exportExcel(id)
                  downloadBlob(blob, `${project.name}.xlsx`)
                  toastSuccess('Excel сформирован')
                } catch (e) {
                  toastError(getFriendlyError(e) || 'Не удалось сформировать Excel')
                }
              }}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStep('compare')} aria-label="Сравнение решений">
              <GitCompare className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {(isGuest || readOnly) && (
        <Disclosure title="О сессии и демо-режиме" className="mb-3">
          {isGuest ? (
            <p>
              {readOnly
                ? 'Это общий демо-проект (только просмотр). Создайте копию на странице «Пример проекта», чтобы редактировать.'
                : 'Гостевая сессия: изменения сохраняются во временном проекте. Для постоянного хранения зарегистрируйтесь.'}
            </p>
          ) : (
            <p>
              Демонстрационный проект только для просмотра. Скопируйте его, чтобы менять параметры и
              план.
            </p>
          )}
        </Disclosure>
      )}

      <div className="mb-4 grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-3 lg:self-start">
          <div className="nc-panel p-1.5">
            <p className="nc-section-label mb-1 px-2 pt-1">Этапы</p>
            <ProjectStageNav
              active={productStage}
              statuses={stageStatuses}
              onChange={goStage}
              recommended={nextStep.stage}
            />
          </div>
          <p className="mt-2 hidden px-1 text-[11px] leading-snug text-steel-500 lg:block">
            {project.summary?.capex != null ? (
              <>
                CAPEX {formatCurrency(project.summary.capex)}
                {project.summary.npv != null ? ` · NPV ${formatCurrency(project.summary.npv)}` : ''}
                <br />
              </>
            ) : null}
            <span
              className={
                econFreshness === 'fresh'
                  ? 'text-emerald-700'
                  : econFreshness === 'stale'
                    ? 'text-amber-800'
                    : 'text-steel-500'
              }
              data-testid="economics-freshness"
              title={
                freshnessQuery.data?.mismatches?.length
                  ? `Расходятся: ${freshnessQuery.data.mismatches.join(', ')}`
                  : undefined
              }
            >
              Экономика: {ECONOMICS_FRESHNESS_LABEL[econFreshness]}
            </span>
          </p>
        </aside>

        <div className="min-w-0 space-y-3">
          <p className="text-xs text-steel-500 lg:hidden">
            {completenessLine}
            {project.summary?.capex != null
              ? ` · CAPEX ${formatCurrency(project.summary.capex)}`
              : ''}
            {' · '}
            <span
              className={
                econFreshness === 'stale'
                  ? 'text-amber-800'
                  : econFreshness === 'fresh'
                    ? 'text-emerald-700'
                    : undefined
              }
              data-testid="economics-freshness-mobile"
            >
              {ECONOMICS_FRESHNESS_LABEL[econFreshness]}
            </span>
          </p>

      {productStage === 'object' && (
        <>
          <Tabs
            items={OBJECT_SUB}
            value={step === 'import' ? 'import' : 'object'}
            onChange={(v) => setStep(v === 'import' ? 'import' : 'object')}
            className="mb-4"
          />
          {(step === 'object' || step === 'params') && (
            <div className="space-y-4">
              {!paramsQuery.isLoading && !paramsQuery.isError && (
                <RequiredInputsBanner
                  economics={economicsReadinessLocal}
                  capabilities={capabilitySummary}
                  onGoField={(field) => {
                    setParamsCompact(true)
                    setFocusParamKey(null)
                    window.requestAnimationFrame(() => setFocusParamKey(field))
                  }}
                  onGoEconomics={() => {
                    if (paramsDirty && !readOnly) {
                      toastError('Сначала сохраните параметры объекта')
                      return
                    }
                    setStep('economics')
                  }}
                />
              )}
              {!paramsQuery.isLoading && !paramsQuery.isError && (
                <AttentionPanel
                  items={attentionItems}
                  onGoFix={(item) => {
                    const target = item.goStep || 'object'
                    if (target === 'object' || target === 'params' || target === 'import') {
                      setStep(item.goField ? 'object' : target === 'import' ? 'import' : 'object')
                      if (item.goField) {
                        // сброс → повторный клик по тому же полю снова запускает фокус
                        setFocusParamKey(null)
                        window.requestAnimationFrame(() => setFocusParamKey(item.goField!))
                      }
                      return
                    }
                    setStep(target)
                  }}
                />
              )}
              <Card
                title="Параметры объекта"
                subtitle="Минимальный набор достаточен для экономики; остальные поля — по необходимости."
                actions={
                  !readOnly ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-medium ${
                          paramsDirty ? 'text-amber-800' : 'text-emerald-700'
                        }`}
                        aria-live="polite"
                      >
                        {saveParamsMut.isPending
                          ? 'Сохранение…'
                          : paramsDirty
                            ? 'Есть несохранённые изменения'
                            : 'Изменения сохранены'}
                      </span>
                      <Button
                        loading={saveParamsMut.isPending}
                        onClick={() => saveParamsMut.mutate()}
                        disabled={!paramsDirty && !saveParamsMut.isPending}
                      >
                        Сохранить параметры
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (paramsDirty) {
                            toastError('Сначала сохраните параметры объекта')
                            return
                          }
                          if (!economicsReadinessLocal.ready && nextStep.step === 'economics') {
                            toastError(
                              economicsReadinessLocal.errors[0]?.message ||
                                'Заполните обязательные поля для экономики',
                            )
                            const first = economicsReadinessLocal.checklist.find((c) => !c.filled)
                            if (first) {
                              setFocusParamKey(null)
                              window.requestAnimationFrame(() => setFocusParamKey(first.field))
                            }
                            return
                          }
                          setStep(nextStep.step === 'object' ? 'selection' : nextStep.step)
                        }}
                      >
                        {nextStep.ctaLabel}
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="warning">Только просмотр</Badge>
                  )
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
                    onChange={(next) => {
                      setParams(next)
                      setParamFieldErrors({})
                    }}
                    schema={paramSchema}
                    readOnly={readOnly}
                    focusField={focusParamKey}
                    onFocusHandled={() => setFocusParamKey(null)}
                    compactMode={paramsCompact}
                    onCompactModeChange={setParamsCompact}
                    fieldErrors={paramFieldErrors}
                    robotPrice={economicsRobotPrice}
                  />
                )}
              </Card>
              {!paramsQuery.isLoading && !paramsQuery.isError && (
                <DataCompletenessPanel
                  params={params}
                  hideAttention
                  onFocusImport={() => setStep('import')}
                  onContinueToMatching={() => {
                    if (paramsDirty && !readOnly) {
                      toastError('Сначала сохраните параметры объекта')
                      return
                    }
                    setStep('selection')
                  }}
                />
              )}
            </div>
          )}
          {step === 'import' && (
            <Card
              title="Импорт параметров объекта"
              subtitle={
                readOnly
                  ? 'Импорт недоступен для демо-проекта — создайте копию'
                  : 'Скачайте Excel-шаблон, заполните жёлтую колонку и загрузите файл'
              }
            >
              {readOnly ? (
                <p className="text-sm text-steel-600">
                  Скопируйте демо-проект, чтобы загружать параметры из Excel.
                </p>
              ) : (
                <ImportFlow projectId={id} />
              )}
            </Card>
          )}
        </>
      )}

      {step === 'layout' && (
        <Card
          title="Планировка объекта"
          subtitle="Координаты в метрах. Импорт DXF или ручная расстановка. DWG не поддерживается."
          actions={
            <Button variant="outline" onClick={() => setStep('selection')}>
              Далее: подбор
            </Button>
          }
        >
          <WarehouseLayoutEditor projectId={id} readOnly={readOnly} />
        </Card>
      )}

      {step === 'selection' && (
        <Card
          title="Подбор решений"
          subtitle="Рейтинг и статусы основаны на параметрах объекта и доступных ТТХ. Отсутствие характеристик не маскируется."
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
              title="Подбор ещё не запускался"
              description="Заполните исходные данные объекта, сохраните их и запустите подбор. Система сравнит требования объекта с каталогом решений."
              actionLabel="Запустить подбор"
              onAction={() => runSelectionMut.mutate()}
            />
          )}
          {results.length > 0 && (
            <div className="space-y-4">
              {economicsRobot ? (
                <Callout variant="info" title="Решение для экономики">
                  Сейчас в расчёте CAPEX/OPEX используется{' '}
                  <strong>{economicsRobot.robot_name || `#${economicsRobot.robot_id}`}</strong>
                  {economicsRobot.robot_price_rub != null
                    ? ` · цена ${formatCurrency(economicsRobot.robot_price_rub)}`
                    : ' · цены в каталоге нет (будет допущение модели)'}
                  . Нажмите «В расчёт» у другой строки, чтобы сменить. Затем откройте экономику и
                  пересчитайте.
                </Callout>
              ) : (
                <Callout variant="warning" title="Решение для расчёта не выбрано">
                  Галочка «Сравнить» не влияет на экономику. Нажмите <strong>В расчёт</strong> у
                  нужного решения (например Ronavi H2000), затем пересчитайте экономику.
                </Callout>
              )}
              {(() => {
                const suitableN = results.filter((r) => r.status === 'suitable').length
                const reviewN = results.filter((r) => r.status === 'needs_review').length
                const excludedN = results.filter((r) => r.status === 'excluded').length
                if (suitableN === 0 && reviewN === 0) {
                  return (
                    <Callout variant="danger" title="Подходящих решений не найдено">
                      Ослабьте ограничения объекта (грузоподъёмность, ширина прохода) или уточните
                      параметры. Можно просмотреть исключённые варианты ({excludedN}) и проверить
                      причины в развёрнутой строке.
                    </Callout>
                  )
                }
                if (suitableN === 0 && reviewN > 0) {
                  return (
                    <Callout variant="warning" title="Варианты найдены, но требуют проверки">
                      Подходящих без оговорок нет. {reviewN} решений отмечены как «Требует проверки»
                      из‑за неполных ТТХ или допущений. Раскройте строку — увидите недостающие
                      проверки и следующий шаг.
                    </Callout>
                  )
                }
                return (
                  <Callout variant="success" title="Подходящие решения найдены">
                    Предварительно подходит: {suitableN}
                    {reviewN > 0 ? ` · требует проверки: ${reviewN}` : ''}
                    {excludedN > 0 ? ` · не подходит: ${excludedN}` : ''}. Отметьте варианты для
                    сравнения и перейдите к сценариям.
                  </Callout>
                )
              })()}
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
                        <th className="px-3 py-2">Сравнить</th>
                        <th className="px-3 py-2">Название</th>
                        <th className="px-3 py-2">Грузоподъёмность</th>
                        <th className="px-3 py-2">Цена</th>
                        <th className="px-3 py-2">Статус</th>
                        <th className="px-3 py-2">Оценка</th>
                        <th className="px-3 py-2">Кол-во</th>
                        <th className="px-3 py-2">Расчёт</th>
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
                                <div className="space-y-0.5">
                                  <Badge variant="info">{formatNumber(r.match_score, 1)}</Badge>
                                  <p className="max-w-[10rem] text-[11px] leading-snug text-steel-500">
                                    {r.score_label ||
                                      (r.match_score >= 80
                                        ? 'Высокое соответствие'
                                        : r.match_score >= 60
                                          ? 'Умеренное — нужна проверка'
                                          : r.match_score >= 40
                                            ? 'Слабое соответствие'
                                            : 'Низкое / исключение')}
                                  </p>
                                </div>
                              ) : (
                                'Нет данных'
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {r.recommended_count != null
                                ? formatNumber(r.recommended_count)
                                : '—'}
                            </td>
                            <td className="px-3 py-2">
                              {economicsRobotId === r.robot_id ? (
                                <Badge variant="success">В расчёте</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={readOnly || selectForEconMut.isPending}
                                  loading={
                                    selectForEconMut.isPending &&
                                    selectForEconMut.variables === r.robot_id
                                  }
                                  onClick={() => selectForEconMut.mutate(r.robot_id)}
                                  aria-label={`Использовать ${r.robot_name || r.robot_id} для расчёта`}
                                >
                                  В расчёт
                                </Button>
                              )}
                            </td>
                          </tr>
                          {open && (
                            <tr className="border-t border-steel-100 bg-steel-50/60">
                              <td colSpan={9} className="px-4 py-3">
                                {(() => {
                                  const warnings = [...matches, ...exclusions].filter((m) =>
                                    isMissingDataWarning(m),
                                  )
                                  const matchOnly = matches.filter((m) => !isMissingDataWarning(m))
                                  const exclOnly = exclusions.filter((m) => !isMissingDataWarning(m))
                                  return (
                                    <div className="space-y-4">
                                      {r.recommendation_text && (
                                        <div className="rounded border border-brand-200 bg-brand-50/50 px-3 py-2 text-sm text-steel-800">
                                          <p className="font-medium text-steel-900">Рекомендация</p>
                                          <p className="mt-1">{r.recommendation_text}</p>
                                          {r.estimated_capex != null && (
                                            <p className="mt-1 text-xs text-steel-600">
                                              Оценка CAPEX (допущение): {formatCurrency(r.estimated_capex)}
                                              {r.estimated_payback_years != null
                                                ? ` · окупаемость ≈ ${formatNumber(r.estimated_payback_years, 1)} лет`
                                                : ''}
                                            </p>
                                          )}
                                        </div>
                                      )}
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
                                                  <span className="text-emerald-600">✓</span>{' '}
                                                  {m.replace(/^[✓✔]\s*/, '')}
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

      {productStage === 'economics' && (
        <>
          <Tabs
            items={ECON_SUB}
            value={
              step === 'scenarios' || step === 'fleet' || step === 'economics' ? step : 'economics'
            }
            onChange={setStep}
            className="mb-4"
          />
          {step === 'economics' && (
            <EconomicsPanel
              projectId={id}
              mode="economics"
              paramsDirty={paramsDirty}
              onGoField={(field) => {
                setStep('object')
                setParamsCompact(true)
                setFocusParamKey(null)
                window.requestAnimationFrame(() => setFocusParamKey(field))
              }}
            />
          )}
          {step === 'scenarios' && (
            <EconomicsPanel
              projectId={id}
              mode="scenarios"
              paramsDirty={paramsDirty}
              onGoField={(field) => {
                setStep('object')
                setParamsCompact(true)
                setFocusParamKey(null)
                window.requestAnimationFrame(() => setFocusParamKey(field))
              }}
            />
          )}
          {step === 'fleet' && <FleetComparePanel projectId={id} />}
        </>
      )}

      {step === 'visualization' && (
        <Card
          title="Симуляция"
          subtitle="Дискретно-событийная демонстрация по плану (не цифровой двойник). KPI экономики здесь не пересчитываются."
        >
          {!capabilitySummary.des_ready && (
            <Callout variant="warning" className="mb-3" data-testid="des-inputs-incomplete">
              DES недоступен: нужен сохранённый расчёт экономики и габариты площадки (или план).
              Экономический расчёт при этом не блокируется.
              {!economicsReadinessLocal.ready && (
                <button
                  type="button"
                  className="ml-1 font-medium text-brand-800 hover:underline"
                  onClick={() => setStep('object')}
                >
                  Заполнить параметры
                </button>
              )}
            </Callout>
          )}
          {capabilitySummary.des_ready &&
            Array.isArray(
              (readinessQuery.data as { layout?: { warnings?: { code?: string; message?: string }[] } })
                ?.layout?.warnings,
            ) &&
            (
              readinessQuery.data as { layout?: { warnings?: { code?: string; message?: string }[] } }
            ).layout!.warnings!.some((w) => w.code === 'example_geometry') && (
              <Callout variant="info" className="mb-3" data-testid="des-example-layout-warning">
                На плане демо-пример геометрии, не обмер объекта. Уточните планировку перед опорой на
                DES в отчёте. Экономика уже доступна отдельно.
              </Callout>
            )}
          <div className="mb-3 grid gap-2 rounded border border-steel-100 bg-steel-50/80 px-3 py-2.5 text-sm text-steel-800 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <p className="nc-section-label">Объект</p>
              <p className="truncate font-medium" title={project.name}>{project.name}</p>
            </div>
            <div>
              <p className="nc-section-label">Сценарий</p>
              <p className="font-medium">
                {scenarioId === 'baseline'
                  ? 'Без роботизации'
                  : scenarioId === 'raas'
                    ? 'RaaS'
                    : 'Покупка'}
              </p>
            </div>
            <div>
              <p className="nc-section-label">Роботов в симуляции</p>
              <p className="font-mono font-medium tabular-nums">
                {simRobotsCount ?? calcQuery.data?.robot_count ?? '—'}
              </p>
            </div>
            <div>
              <p className="nc-section-label">Модель</p>
              <p className="font-medium">Демонстрационная DES</p>
            </div>
          </div>
          <Callout variant="info" className="mb-3">
            Геометрия берётся из сохранённого плана (метры). Анимация показывает не более 6 роботов
            на схеме даже если в конфигурации больше — это ограничение отображения, не «потеря»
            роботов в модели. DES-демо, не цифровой двойник.
          </Callout>
          {econRobotsQuery.data != null &&
            simRobotsCount != null &&
            econRobotsQuery.data !== simRobotsCount && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p>
                  Экономика рассчитана на <strong>{econRobotsQuery.data}</strong> роботов, симуляция
                  показывает <strong>{simRobotsCount}</strong>. Это разные конфигурации: KPI экономики
                  не пересчитываются автоматически при изменении числа роботов здесь.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSimRobotsCount(econRobotsQuery.data!)
                    void qc.invalidateQueries({ queryKey: ['visualization', id] })
                    void qc.invalidateQueries({ queryKey: ['calculation', id] })
                  }}
                >
                  Как в экономике ({econRobotsQuery.data})
                </Button>
              </div>
            )}
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
              robotsCount={simRobotsCount ?? calcQuery.data.robot_count}
              onRobotsCountChange={(n) => {
                setSimRobotsCount(n)
                void qc.invalidateQueries({ queryKey: ['visualization', id] })
                void qc.invalidateQueries({ queryKey: ['calculation', id] })
              }}
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

      {productStage === 'report' && (
        <>
          <Tabs
            items={REPORT_SUB}
            value={step === 'results' ? 'results' : 'report'}
            onChange={setStep}
            className="mb-4"
          />
          {step !== 'results' && (
            <PresentationPanel
              project={project}
              projectId={id}
              onEdit={() => setStep('object')}
              onSimulate={() => setStep('visualization')}
            />
          )}
        </>
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
                  <ResultKpi
                    title={metricLabel('capex')}
                    value={formatCurrency(econ.capex?.capex)}
                  />
                  <ResultKpi
                    title={metricLabel('annual_effect')}
                    value={formatCurrency(
                      econ.annual_effect?.net_annual_effect ?? econ.annual_effect?.annual_effect,
                    )}
                  />
                  <ResultKpi title={metricLabel('payback')} value={formatPayback(econ.payback)} />
                  <ResultKpi
                    title={metricLabel('npv')}
                    value={
                      econ.npv?.npv != null
                        ? formatCurrency(econ.npv.npv)
                        : 'Недостаточно данных для расчёта'
                    }
                  />
                  <ResultKpi
                    title={metricLabel('robots_count')}
                    value={formatNumber(econ.robots_count)}
                  />
                  <ResultKpi
                    title={metricLabel('opex_year')}
                    value={formatCurrency(econ.opex?.opex_annual)}
                  />
                  <ResultKpi
                    title={metricLabel('roi')}
                    value={
                      econ.roi?.roi_percent != null
                        ? formatPercent(Number(econ.roi.roi_percent))
                        : typeof econ.roi?.message === 'string'
                          ? 'Не применяется'
                          : 'Недостаточно данных для расчёта'
                    }
                  />
                  <ResultKpi title={metricLabel('tco')} value={formatCurrency(econ.tco?.tco)} />
                  <ResultKpi
                    title="IRR"
                    value={
                      econ.irr?.irr != null
                        ? formatPercent(Number(econ.irr.irr))
                        : 'Не определён'
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded border border-steel-200 bg-white p-4">
                  <h3 className="mb-2 text-sm font-semibold text-steel-800">Состав CAPEX</h3>
                  <dl className="space-y-1.5 text-sm">
                    {Object.entries(econ.capex?.breakdown || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-steel-50 py-1">
                        <dt className="text-steel-500">{breakdownLabel(k)}</dt>
                        <dd className="font-medium">{formatBreakdownValue(k, v)}</dd>
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
                        <dd className="font-medium">{formatBreakdownValue(k, v)}</dd>
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
      </div>
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
