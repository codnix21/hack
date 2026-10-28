import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { Info, Play, RotateCcw } from 'lucide-react'
import { economicsApi, type EconomicsExplainResponse } from '../../api/economics'
import { projectsApi } from '../../api/projects'
import { getFriendlyError } from '../../api/client'
import { AttentionPanel } from './AttentionPanel'
import { buildAttentionItems } from '../../utils/attention'
import { scenarioCompareColumnKeys } from './scenarioCompare'
import type {
  EconomicsRequest,
  EconomicsScenarioResult,
  SensitivityPoint,
} from '../../types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'
import { Table } from '../ui/Table'
import { Skeleton } from '../ui/Skeleton'
import {
  formatBreakdownValue,
  formatCurrency,
  formatNumber,
  formatPayback,
  formatPercent,
} from '../../utils/format'
import {
  assumptionLabel,
  breakdownLabel,
  formulaLabel,
  metricLabel,
  robotsCountSourceLabel,
} from '../../utils/labels'
import { toastError, toastSuccess } from '../../store/toastStore'
import {
  ECONOMICS_FRESHNESS_LABEL,
  resolveEconomicsFreshness,
} from '../../utils/economicsFreshness'
import {
  assessEconomicsLocal,
  parseInputsIncompleteDetail,
  type InputIssue,
} from '../../utils/requiredInputs'
import { useChartTheme } from '../../utils/chartTheme'
import { Badge } from '../ui/Badge'
import { Callout } from '../ui/Callout'
import axios from 'axios'

interface EconomicsPanelProps {
  projectId: string
  /** economics — расчёт покупки и разбивка; scenarios — сравнение 3 сценариев + what-if */
  mode?: 'economics' | 'scenarios'
  /** Несохранённые параметры объекта → «Требуется пересчёт» */
  paramsDirty?: boolean
  /** Перейти к полю параметров объекта */
  onGoField?: (field: string) => void
}

const SCENARIO_CODES = ['baseline', 'purchase', 'raas'] as const

const SCENARIO_LABELS: Record<string, string> = {
  baseline: 'Без роботизации',
  purchase: 'Покупка оборудования',
  raas: 'Роботы как услуга',
}

interface WhatIfSliders {
  utilization: number
  reserve: number
  years: number
  labor_reduction_share: number
  unit_price_factor: number
  peak_demand_factor: number
  labor_cost_factor: number
}

const DEFAULT_WHAT_IF: WhatIfSliders = {
  utilization: 85,
  reserve: 10,
  years: 5,
  labor_reduction_share: 40,
  unit_price_factor: 0,
  peak_demand_factor: 0,
  labor_cost_factor: 0,
}

function deltaPct(base: number | null | undefined, next: number | null | undefined): string {
  if (base == null || next == null || base === 0 || !Number.isFinite(base) || !Number.isFinite(next)) {
    return 'Нет данных'
  }
  return formatPercent(((next - base) / Math.abs(base)) * 100, 1)
}

function kpiValue(
  r: EconomicsScenarioResult | null,
  key: 'capex' | 'opex_yearly' | 'annual_effect' | 'tco' | 'roi' | 'payback_years',
): number | null {
  if (!r) return null
  if (key === 'capex') return r.capex?.capex ?? null
  if (key === 'opex_yearly') return r.opex?.opex_annual ?? null
  if (key === 'annual_effect') return r.annual_effect?.annual_effect ?? null
  if (key === 'tco') return r.tco?.tco ?? null
  if (key === 'roi') return r.roi?.roi_percent ?? null
  if (key === 'payback_years') {
    // По CF за горизонт может быть null — тогда берём простую оценку CAPEX/эффект
    const y = r.payback?.payback_years
    if (y != null && !Number.isNaN(Number(y))) return Number(y)
    const simple = r.payback?.simple_payback_years
    if (simple != null && !Number.isNaN(Number(simple))) return Number(simple)
    return null
  }
  return null
}

function kpiPaybackDisplay(r: EconomicsScenarioResult | null): string {
  if (!r) return '—'
  return formatPayback(r.payback)
}

function scenarioRow(r: EconomicsScenarioResult) {
  const cc = (r.cost_comparison || {}) as {
    raas_service_year?: number | null
    remaining_manual_labor_annual?: number | null
    total_outlay_with_remaining_labor?: number | null
  }
  const fc = r.fleet_capacity
  return {
    id: r.scenario,
    name: r.scenario_name_ru || SCENARIO_LABELS[r.scenario] || r.scenario,
    capex: r.capex?.capex ?? 0,
    opex_yearly: r.opex?.opex_annual ?? 0,
    annual_effect: r.annual_effect?.annual_effect ?? 0,
    payback_years: r.payback?.payback_years ?? null,
    payback_display: formatPayback(r.payback),
    roi: r.roi?.roi_percent ?? null,
    roi_message: typeof r.roi?.message === 'string' ? r.roi.message : null,
    tco: r.tco?.tco ?? 0,
    npv: r.npv?.npv ?? null,
    npv_message: typeof r.npv?.message === 'string' ? r.npv.message : null,
    raas_service_year: cc.raas_service_year ?? null,
    remaining_labor: cc.remaining_manual_labor_annual ?? r.remaining_manual_labor_cost ?? null,
    total_outlay: cc.total_outlay_with_remaining_labor ?? null,
    robots_count: r.robots_count ?? 0,
    peak_coverage:
      fc?.peak_coverage != null ? Number(fc.peak_coverage) : null,
    meets_peak: fc?.meets_peak_demand ?? null,
    input_warnings: r.input_warnings || [],
  }
}

export function EconomicsPanel({
  projectId,
  mode = 'scenarios',
  paramsDirty = false,
  onGoField,
}: EconomicsPanelProps) {
  const qc = useQueryClient()
  const isEconomics = mode === 'economics'
  const isScenarios = mode === 'scenarios'
  const [whatIf, setWhatIf] = useState<WhatIfSliders>({ ...DEFAULT_WHAT_IF })
  const [scenarios, setScenarios] = useState<ReturnType<typeof scenarioRow>[]>([])
  const [assumptions, setAssumptions] = useState<Record<string, number | string | boolean>>({})
  const [lastResult, setLastResult] = useState<EconomicsScenarioResult | null>(null)
  const [basePurchase, setBasePurchase] = useState<EconomicsScenarioResult | null>(null)
  const [altPurchase, setAltPurchase] = useState<EconomicsScenarioResult | null>(null)
  const [baseUnitPrice, setBaseUnitPrice] = useState(0)
  const [basePeakDemand, setBasePeakDemand] = useState(0)
  const [baseLaborCost, setBaseLaborCost] = useState(0)
  const [sensitivityByParam, setSensitivityByParam] = useState<
    Record<string, SensitivityPoint[]>
  >({})
  const [, setAltDelta] = useState<Record<string, number> | null>(null)
  const [explainOpen, setExplainOpen] = useState(false)
  const [explainData, setExplainData] = useState<EconomicsExplainResponse | null>(null)
  const [showAllScenarioCols, setShowAllScenarioCols] = useState(false)
  const [inputIssues, setInputIssues] = useState<InputIssue[]>([])
  const charts = useChartTheme()

  const paramsForAttention = useQuery({
    queryKey: ['project-params', projectId],
    queryFn: () => projectsApi.getParams(projectId),
    staleTime: 30_000,
  })

  const localReadiness = useMemo(
    () => assessEconomicsLocal(paramsForAttention.data?.object_params || {}),
    [paramsForAttention.data?.object_params],
  )

  const whatIfDirty = useMemo(
    () => JSON.stringify(whatIf) !== JSON.stringify(DEFAULT_WHAT_IF),
    [whatIf],
  )

  const baseRequest = useMemo<EconomicsRequest>(
    () => ({
      scenario: 'purchase',
      utilization: whatIf.utilization / 100,
      reserve: whatIf.reserve / 100,
      years: whatIf.years,
      overrides: {
        labor_reduction_share: whatIf.labor_reduction_share / 100,
      },
    }),
    [whatIf],
  )

  const formulasQuery = useQuery({
    queryKey: ['economics-formulas'],
    queryFn: () => economicsApi.formulas(),
  })

  const freshnessQuery = useQuery({
    queryKey: ['economics-freshness', projectId],
    queryFn: () => economicsApi.freshness(projectId),
    staleTime: 15_000,
  })

  const freshness = resolveEconomicsFreshness(freshnessQuery.data?.status, {
    paramsDirty,
    hasStoredResult: lastResult?.capex?.capex != null || freshnessQuery.data?.status === 'fresh',
  })

  const calcAllMut = useMutation({
    mutationFn: async () => {
      const results: EconomicsScenarioResult[] = []
      for (const code of SCENARIO_CODES) {
        const res = await economicsApi.calculate(projectId, {
          ...baseRequest,
          scenario: code,
        })
        results.push(res.results)
      }
      return results
    },
    onSuccess: (results) => {
      setInputIssues([])
      setScenarios(results.map(scenarioRow))
      const purchase = results.find((r) => r.scenario === 'purchase')
      if (purchase) {
        setLastResult(purchase)
        setBasePurchase(purchase)
        setAltPurchase(null)
        setAltDelta(null)
        if (purchase.assumptions) setAssumptions(purchase.assumptions)
        const inputs = (purchase.inputs || {}) as Record<string, unknown>
        const up = Number(inputs.unit_price ?? purchase.assumptions?.unit_price)
        if (!Number.isNaN(up) && up > 0) setBaseUnitPrice(up)
        const peak = Number(inputs.peak_demand ?? purchase.assumptions?.peak_demand)
        if (!Number.isNaN(peak) && peak > 0) setBasePeakDemand(peak)
        const labor = Number(
          inputs.current_labor_cost_year ?? purchase.assumptions?.current_labor_cost_year,
        )
        if (!Number.isNaN(labor) && labor > 0) setBaseLaborCost(labor)
      }
      void qc.invalidateQueries({ queryKey: ['economics-freshness', projectId] })
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: ['inputs-readiness', projectId] })
      toastSuccess('Экономика рассчитана')
    },
    onError: (e) => {
      const detail = axios.isAxiosError(e) ? e.response?.data?.detail : undefined
      const issues = parseInputsIncompleteDetail(detail)
      if (issues.length) {
        setInputIssues(issues)
        toastError(issues.map((i) => i.message).join('; '))
        return
      }
      toastError(getFriendlyError(e))
    },
  })

  useEffect(() => {
    if (!paramsForAttention.isSuccess) return
    if (!localReadiness.ready) {
      setInputIssues(localReadiness.errors)
      return
    }
    calcAllMut.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, paramsForAttention.isSuccess, localReadiness.ready])

  const whatIfMut = useMutation({
    mutationFn: () => {
      const unitPrice = baseUnitPrice * (1 + whatIf.unit_price_factor / 100)
      const peakDemand = basePeakDemand * (1 + whatIf.peak_demand_factor / 100)
      const laborCost = baseLaborCost * (1 + whatIf.labor_cost_factor / 100)
      return economicsApi.whatIf(projectId, {
        base: { ...baseRequest, scenario: 'purchase' },
        changes: {
          utilization: whatIf.utilization / 100,
          reserve: whatIf.reserve / 100,
          years: whatIf.years,
          labor_reduction_share: whatIf.labor_reduction_share / 100,
          unit_price: unitPrice,
          peak_demand: peakDemand,
          current_labor_cost_year: laborCost,
        },
      })
    },
    onSuccess: (data) => {
      setAltDelta(data.delta)
      setAltPurchase(data.alternative)
      if (data.base) setBasePurchase(data.base)
      setScenarios((prev) => {
        const next = [...prev]
        const idx = next.findIndex((s) => s.id === 'purchase')
        const alt = scenarioRow(data.alternative)
        if (idx >= 0) next[idx] = { ...alt, id: 'purchase', name: 'Покупка (изменённый)' }
        else next.push(alt)
        return next
      })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const resetWhatIf = () => {
    setWhatIf({ ...DEFAULT_WHAT_IF })
    setAltDelta(null)
    setAltPurchase(null)
    if (basePurchase) {
      setScenarios((prev) => {
        const next = [...prev]
        const idx = next.findIndex((s) => s.id === 'purchase')
        const row = scenarioRow(basePurchase)
        if (idx >= 0) next[idx] = { ...row, id: 'purchase', name: SCENARIO_LABELS.purchase }
        return next
      })
    }
    toastSuccess('Изменения сброшены к допущениям')
  }

  const sensitivityMut = useMutation({
    mutationFn: async () => {
      const base = { ...baseRequest, scenario: 'purchase' as const }
      // ТЗ 3.5.6: минимум стоимость оборудования, объём операций, стоимость труда
      const [price, peak, labor] = await Promise.all([
        economicsApi.sensitivity(projectId, {
          base,
          parameter: 'unit_price',
          values: [0.7, 0.85, 1, 1.15, 1.3].map((f) => baseUnitPrice * f),
        }),
        economicsApi.sensitivity(projectId, {
          base,
          parameter: 'peak_demand',
          values: [0.7, 0.85, 1, 1.15, 1.3].map((f) => basePeakDemand * f),
        }),
        economicsApi.sensitivity(projectId, {
          base,
          parameter: 'current_labor_cost_year',
          values: [0.7, 0.85, 1, 1.15, 1.3].map((f) => baseLaborCost * f),
        }),
      ])
      return {
        unit_price: price.rows || [],
        peak_demand: peak.rows || [],
        current_labor_cost_year: labor.rows || [],
      }
    },
    onSuccess: (data) => setSensitivityByParam(data),
    onError: (e) => toastError(getFriendlyError(e)),
  })

  useEffect(() => {
    if (!scenarios.length) return
    const t = window.setTimeout(() => {
      whatIfMut.mutate()
      sensitivityMut.mutate()
    }, 450)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatIf, projectId, baseUnitPrice, basePeakDemand, baseLaborCost])

  const openExplain = async () => {
    setExplainOpen(true)
    const explained = await economicsApi.explain(projectId, { ...baseRequest, scenario: 'purchase' })
    setExplainData(explained)
  }

  const blockingIssues =
    inputIssues.length > 0 ? inputIssues : !localReadiness.ready ? localReadiness.errors : []

  if (!localReadiness.ready && scenarios.length === 0) {
    return (
      <div className="space-y-3" data-testid="economics-inputs-incomplete">
        <Callout variant="warning">
          <p className="font-medium">Недостаточно данных для расчёта экономики</p>
          <p className="mt-1 text-sm">
            Минимальные данные: {localReadiness.filled_required} из{' '}
            {localReadiness.total_required}. Заполните обязательные поля — подстановки по умолчанию не
            используются.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {localReadiness.checklist
              .filter((c) => !c.filled)
              .map((c) => (
                <li key={c.field}>
                  <button
                    type="button"
                    className="font-medium text-[var(--nc-link)] hover:underline"
                    onClick={() => onGoField?.(c.field)}
                  >
                    {c.label}
                  </button>
                  <span className="text-[var(--nc-text)]"> — {c.reason}</span>
                </li>
              ))}
          </ul>
        </Callout>
        <Button
          variant="outline"
          onClick={() => {
            const first = localReadiness.checklist.find((c) => !c.filled)
            if (first) onGoField?.(first.field)
          }}
        >
          К параметрам объекта
        </Button>
      </div>
    )
  }

  if (calcAllMut.isPending && scenarios.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (calcAllMut.isError && scenarios.length === 0) {
    return (
      <div className="space-y-3" data-testid="economics-inputs-incomplete">
        <Callout variant="warning">
          <p className="font-medium">Расчёт недоступен</p>
          <p className="mt-1 text-sm">{getFriendlyError(calcAllMut.error)}</p>
          {blockingIssues.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {blockingIssues.map((issue) => (
                <li key={`${issue.field}-${issue.code}`}>
                  <button
                    type="button"
                    className="font-medium text-[var(--nc-link)] hover:underline"
                    onClick={() => onGoField?.(issue.field)}
                  >
                    {issue.field}
                  </button>
                  <span className="text-[var(--nc-text)]"> — {issue.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Callout>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => calcAllMut.mutate()}>
            <Play className="h-4 w-4" />
            Повторить расчёт
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const first = blockingIssues[0]
              if (first) onGoField?.(first.field)
            }}
          >
            К параметрам
          </Button>
        </div>
      </div>
    )
  }

  const best = scenarios.reduce<(typeof scenarios)[0] | null>((acc, s) => {
    if (s.id === 'baseline') return acc
    if (!acc) return s
    return (s.annual_effect || 0) > (acc.annual_effect || 0) ? s : acc
  }, null)

  const chartCapexKey = metricLabel('capex')
  const chartOpexKey = metricLabel('opex_year')
  const chartData = scenarios.map((s) => ({
    name: s.name,
    'Годовой эффект': s.annual_effect,
    [chartCapexKey]: s.capex,
    [chartOpexKey]: s.opex_yearly,
  }))

  const formulaEntries = Object.entries(formulasQuery.data?.formulas || {}).map(
    ([name, expression]) => ({ name, expression, description: '' }),
  )

  const explainSteps =
    explainData?.steps && Array.isArray(explainData.steps) ? explainData.steps : null

  const breakdownEntries = lastResult
    ? [
        ...Object.entries(lastResult.capex?.breakdown || {}).map(([k, v]) => ({
          group: 'Капитальные затраты',
          key: k,
          value: v,
        })),
        ...Object.entries(lastResult.opex?.breakdown || {}).map(([k, v]) => ({
          group: 'Эксплуатационные расходы',
          key: k,
          value: v,
        })),
        ...Object.entries(lastResult.annual_effect?.components || {}).map(([k, v]) => ({
          group: 'Эффект',
          key: k,
          value: v,
        })),
      ]
    : []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="nc-title-sm">
              {isEconomics ? 'Экономика внедрения' : 'Сравнение сценариев'}
            </h2>
            <Badge
              variant={
                freshness === 'fresh' ? 'success' : freshness === 'stale' ? 'warning' : 'default'
              }
              title={
                freshnessQuery.data?.mismatches?.length
                  ? `Расходятся: ${freshnessQuery.data.mismatches.join(', ')}`
                  : undefined
              }
              data-testid="economics-freshness-badge"
            >
              {ECONOMICS_FRESHNESS_LABEL[freshness]}
            </Badge>
          </div>
          <p className="nc-body mt-0.5 text-xs">
            {isEconomics
              ? 'Инвестиции, эффект и окупаемость сценария «Покупка».'
              : 'Сценарии «без роботов / покупка / аренда» и чувствительность.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            loading={calcAllMut.isPending}
            disabled={!localReadiness.ready || paramsDirty}
            title={
              paramsDirty
                ? 'Сначала сохраните параметры объекта'
                : !localReadiness.ready
                  ? 'Заполните обязательные поля'
                  : undefined
            }
            onClick={() => {
              if (paramsDirty) {
                toastError('Сначала сохраните параметры объекта')
                return
              }
              if (!localReadiness.ready) {
                setInputIssues(localReadiness.errors)
                toastError(
                  localReadiness.errors[0]?.message || 'Недостаточно данных для расчёта',
                )
                return
              }
              calcAllMut.mutate()
            }}
          >
            <Play className="h-4 w-4" />
            {isEconomics ? 'Рассчитать' : 'Пересчитать'}
          </Button>
          <Button size="sm" variant="outline" onClick={openExplain} disabled={!localReadiness.ready}>
            <Info className="h-4 w-4" />
            Как рассчитано
          </Button>
        </div>
      </div>

      {freshness === 'stale' && (
        <Callout variant="warning" data-testid="economics-stale-banner">
          <p className="text-sm font-medium">Экономика устарела</p>
          <p className="mt-1 text-sm">
            Параметры или состав решений изменились. Нажмите «Рассчитать», чтобы обновить показатели.
          </p>
        </Callout>
      )}

      {blockingIssues.length > 0 && (
        <Callout variant="warning" data-testid="economics-missing-inputs">
          <p className="text-sm font-medium">Перед расчётом укажите:</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {blockingIssues.map((issue) => (
              <li key={`${issue.field}-${issue.code}`}>
                <button
                  type="button"
                  className="text-[var(--nc-link)] hover:underline"
                  onClick={() => onGoField?.(issue.field)}
                >
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {isEconomics && (
        <>
          <div className="space-y-2" data-testid="economics-kpi-row">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              title={metricLabel('capex')}
              value={
                lastResult?.capex?.capex != null
                  ? formatCurrency(lastResult.capex.capex)
                  : 'Нет данных'
              }
            />
            <Kpi
              title={metricLabel('annual_effect')}
              value={formatCurrency(
                lastResult?.annual_effect?.net_annual_effect ??
                  lastResult?.annual_effect?.annual_effect,
              )}
            />
            <Kpi
              title={metricLabel('payback')}
              value={lastResult ? formatPayback(lastResult.payback) : 'Нет данных'}
              hint={
                lastResult?.payback?.payback_years == null && lastResult?.payback?.message
                  ? String(lastResult.payback.message)
                  : undefined
              }
            />
            <Kpi
              title={metricLabel('npv')}
              value={
                lastResult?.npv?.npv != null
                  ? formatCurrency(lastResult.npv.npv)
                  : typeof lastResult?.npv?.message === 'string'
                    ? 'Не применяется'
                    : 'Нет данных'
              }
            />
          </div>
          <AttentionPanel
            items={buildAttentionItems({
              params: paramsForAttention.data?.object_params || {},
              economicsWarnings: lastResult?.input_warnings,
            })}
          />
          {lastResult?.fleet_capacity && (
            <details
              className={`rounded border px-3 py-2 text-sm ${
                lastResult.fleet_capacity.meets_peak_demand
                  ? 'border-[var(--nc-border)] bg-[var(--nc-surface-muted)] text-[var(--nc-ink)]'
                  : 'border-[rgba(245,193,74,0.45)] bg-[var(--nc-warning-soft)] text-[var(--nc-warning)]'
              }`}
              open={!lastResult.fleet_capacity.meets_peak_demand}
            >
              <summary className="cursor-pointer font-medium text-[var(--nc-ink)]">
                {metricLabel('fleet_capacity')}
                {!lastResult.fleet_capacity.meets_peak_demand
                  ? ' — парк не покрывает пик'
                  : ' — подробности покрытия пика'}
              </summary>
              <div className="mt-2">
                <p className="text-xs opacity-90">
                  Единицы — операции/час (не паллеты). Пик может быть расчётной оценкой из суточного
                  объёма. Это не физический цифровой двойник склада.
                </p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide opacity-70">Выбрано роботов</dt>
                    <dd className="font-mono text-base font-semibold">
                      {lastResult.fleet_capacity.selected_robots ?? lastResult.robots_count ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide opacity-70">Расчётная потребность</dt>
                    <dd className="font-mono text-base font-semibold">
                      {lastResult.fleet_capacity.recommended_robots ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide opacity-70">Покрытие пика</dt>
                    <dd className="font-mono text-base font-semibold">
                      {lastResult.fleet_capacity.peak_coverage != null
                        ? `${(Number(lastResult.fleet_capacity.peak_coverage) * 100).toFixed(1)}%`
                        : 'Нет данных'}
                      {lastResult.fleet_capacity.peak_is_estimate ? ' · расчётная оценка' : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide opacity-70">Ёмкость парка</dt>
                    <dd className="font-mono">
                      {lastResult.fleet_capacity.fleet_capacity_ops_per_hour != null
                        ? `${formatNumber(Number(lastResult.fleet_capacity.fleet_capacity_ops_per_hour))} оп/ч`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide opacity-70">Пиковая нагрузка</dt>
                    <dd className="font-mono">
                      {lastResult.fleet_capacity.peak_demand_ops_per_hour != null
                        ? `${formatNumber(Number(lastResult.fleet_capacity.peak_demand_ops_per_hour))} оп/ч`
                        : '—'}
                    </dd>
                  </div>
                </dl>
                {!lastResult.fleet_capacity.meets_peak_demand && (
                  <p className="mt-2 font-medium">
                    Выбранный парк не покрывает расчётную пиковую нагрузку. Экономика отражает
                    выбранную конфигурацию.
                  </p>
                )}
                <p className="mt-2 text-xs opacity-80">
                  Источник числа роботов:{' '}
                  {robotsCountSourceLabel(lastResult.fleet_capacity.robots_count_source)}.
                </p>
              </div>
            </details>
          )}
          <details className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface)] px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-[var(--nc-ink)]">
              Ещё показатели · роботы, эксплуатация, рентабельность
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                title={metricLabel('robots_count')}
                value={
                  lastResult?.robots_count != null
                    ? formatNumber(lastResult.robots_count)
                    : 'Нет данных'
                }
              />
              <Kpi
                title={metricLabel('opex_year')}
                value={
                  lastResult?.opex?.opex_annual != null
                    ? formatCurrency(lastResult.opex.opex_annual)
                    : 'Нет данных'
                }
              />
              <Kpi
                title={metricLabel('roi')}
                value={
                  lastResult?.roi?.roi_percent != null
                    ? formatPercent(Number(lastResult.roi.roi_percent))
                    : typeof lastResult?.roi?.message === 'string'
                      ? 'Не применяется'
                      : 'Нет данных'
                }
              />
              <Kpi
                title={metricLabel('tco')}
                value={
                  lastResult?.tco?.tco != null ? formatCurrency(lastResult.tco.tco) : 'Нет данных'
                }
              />
            </div>
          </details>
          </div>

          <details className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface)] px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-[var(--nc-ink)]">
              Состав затрат и амортизация
            </summary>
            <div className="mt-3 space-y-3">
              {lastResult?.cost_comparison && (
                <ul className="grid gap-1 text-sm text-[var(--nc-text)] sm:grid-cols-2">
                  <li>
                    Оставшийся ручной труд / год:{' '}
                    <span className="font-medium text-[var(--nc-ink)]">
                      {formatCurrency(
                        (lastResult.cost_comparison as { remaining_manual_labor_annual?: number })
                          .remaining_manual_labor_annual,
                      )}
                    </span>
                  </li>
                  <li>
                    Выход с учётом ручного труда:{' '}
                    <span className="font-medium text-[var(--nc-ink)]">
                      {formatCurrency(
                        (
                          lastResult.cost_comparison as {
                            total_outlay_with_remaining_labor?: number
                          }
                        ).total_outlay_with_remaining_labor,
                      )}
                    </span>
                  </li>
                </ul>
              )}
              {lastResult?.depreciation?.applicable &&
                lastResult.depreciation.annual_depreciation != null && (
                  <div
                    className="rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-3 py-2 text-sm"
                    data-testid="depreciation-block"
                  >
                    <p className="font-medium text-[var(--nc-ink)]">
                      Амортизация / год:{' '}
                      {formatCurrency(lastResult.depreciation.annual_depreciation)}
                      <span className="ml-2 text-xs font-normal text-[var(--nc-muted)]">
                        не входит в денежный поток
                      </span>
                    </p>
                  </div>
                )}
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--nc-muted)]">
                    Капитальные затраты
                  </p>
                  {Object.keys(lastResult?.capex?.breakdown || {}).length === 0 ? (
                    <p className="text-sm text-[var(--nc-muted)]">Запустите расчёт.</p>
                  ) : (
                    <dl className="space-y-1 text-sm">
                      {Object.entries(lastResult!.capex!.breakdown!).map(([k, v]) => {
                        const assumed =
                          lastResult?.capex?.component_sources?.[k]?.origin === 'model_assumption'
                        return (
                          <div
                            key={k}
                            className="flex justify-between gap-3 border-b border-[var(--nc-border-subtle)] py-1"
                          >
                            <dt className="text-[var(--nc-muted)]">
                              {breakdownLabel(k)}
                              {assumed ? (
                                <span className="ml-1 text-[10px] text-amber-700">*</span>
                              ) : null}
                            </dt>
                            <dd className="tabular-nums font-medium text-[var(--nc-ink)]">
                              {formatBreakdownValue(k, v)}
                            </dd>
                          </div>
                        )
                      })}
                    </dl>
                  )}
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--nc-muted)]">
                    Эксплуатация / год
                  </p>
                  {Object.keys(lastResult?.opex?.breakdown || {}).length === 0 ? (
                    <p className="text-sm text-[var(--nc-muted)]">Запустите расчёт.</p>
                  ) : (
                    <dl className="space-y-1 text-sm">
                      {Object.entries(lastResult!.opex!.breakdown!).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex justify-between gap-3 border-b border-[var(--nc-border-subtle)] py-1"
                        >
                          <dt className="text-[var(--nc-muted)]">{breakdownLabel(k)}</dt>
                          <dd className="tabular-nums font-medium text-[var(--nc-ink)]">
                            {formatBreakdownValue(k, v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-[var(--nc-muted)]">
                * доля модели, не КП поставщика. Детали формул — в «Как рассчитано».
              </p>
            </div>
          </details>

          <details className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface)] px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-[var(--nc-ink)]">
              Допущения модели
            </summary>
            <p className="mt-2 text-xs text-[var(--nc-muted)]">
              Значения по умолчанию. Менять — во вкладке «Сценарии и что если».
            </p>
            <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {Object.entries(assumptions)
                .slice(0, 16)
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-3 border-b border-[var(--nc-border-subtle)] py-1"
                  >
                    <dt className="text-[var(--nc-muted)]">{assumptionLabel(k)}</dt>
                    <dd className="tabular-nums font-medium text-[var(--nc-ink)]">{String(v)}</dd>
                  </div>
                ))}
              {Object.keys(assumptions).length === 0 && (
                <p className="text-[var(--nc-muted)] sm:col-span-2">Запустите расчёт.</p>
              )}
            </dl>
          </details>
        </>
      )}

      {isScenarios && (
        <>
      {best && (
        <p className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface)] px-3 py-2 text-sm text-[var(--nc-text)]">
          Лучший по эффекту:{' '}
          <span className="font-semibold text-[var(--nc-ink)]">{best.name}</span>
          {best.annual_effect != null ? (
            <>
              {' '}
              · эффект {formatCurrency(best.annual_effect)}
            </>
          ) : null}
          {best.payback_display ? <> · окупаемость {best.payback_display}</> : null}
          {best.capex != null ? <> · инвестиции {formatCurrency(best.capex)}</> : null}
        </p>
      )}

      <Card
        title="Сравнение сценариев"
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAllScenarioCols((v) => !v)}
          >
            {showAllScenarioCols ? 'Кратко' : 'Все столбцы'}
          </Button>
        }
      >
        <Table
          columns={scenarioCompareColumnKeys(showAllScenarioCols).map((key) => {
            type Row = (typeof scenarios)[0]
            const defs: Record<
              string,
              { header: string; render: (s: Row) => string | number }
            > = {
              name: { header: 'Сценарий', render: (s) => s.name },
              capex: {
                header: metricLabel('capex'),
                render: (s) => formatCurrency(s.capex),
              },
              effect: {
                header: 'Годовой денежный эффект',
                render: (s) => formatCurrency(s.annual_effect),
              },
              payback: {
                header: metricLabel('payback'),
                render: (s) =>
                  s.id === 'raas' ? 'Не применяется к аренде' : s.payback_display || 'Нет данных',
              },
              npv: {
                header: metricLabel('npv'),
                render: (s) =>
                  s.npv != null ? formatCurrency(s.npv) : 'Нет данных',
              },
              robots: {
                header: metricLabel('robots_count'),
                render: (s) =>
                  s.robots_count != null ? String(s.robots_count) : 'Нет данных',
              },
              opex: {
                header: metricLabel('opex_year'),
                render: (s) => formatCurrency(s.opex_yearly),
              },
              raas: {
                header: 'Платежи аренды / год',
                render: (s) =>
                  s.id !== 'raas'
                    ? '—'
                    : s.raas_service_year != null
                      ? formatCurrency(s.raas_service_year)
                      : 'Нет данных',
              },
              roi: {
                header: metricLabel('roi'),
                render: (s) =>
                  s.id === 'raas' || s.roi_message
                    ? 'Не применяется'
                    : s.roi != null
                      ? formatPercent(Number(s.roi))
                      : 'Нет данных',
              },
              tco: {
                header: metricLabel('tco'),
                render: (s) => formatCurrency(s.tco),
              },
              outlay: {
                header: 'Полный денежный выход',
                render: (s) =>
                  s.total_outlay != null ? formatCurrency(s.total_outlay) : 'Нет данных',
              },
              coverage: {
                header: 'Покрытие пика',
                render: (s) =>
                  s.id === 'baseline'
                    ? '—'
                    : s.peak_coverage != null
                      ? `${(s.peak_coverage * 100).toFixed(0)}%${s.meets_peak === false ? ' ⚠' : ''}`
                      : 'Нет данных',
              },
            }
            const d = defs[key]
            return { key, header: d.header, render: d.render }
          })}
          rows={scenarios}
          rowKey={(s) => s.id}
        />
        <div className="mt-3">
          <AttentionPanel
            items={buildAttentionItems({
              params: paramsForAttention.data?.object_params || {},
              economicsWarnings: Array.from(
                new Set(scenarios.flatMap((s) => s.input_warnings || [])),
              ),
            })}
          />
        </div>
        <details className="mt-4 rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-[var(--nc-ink)]">
            Диаграмма сравнения
          </summary>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 40 }}>
                <CartesianGrid strokeDasharray="2 6" stroke={charts.grid} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: charts.tick }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={48}
                  axisLine={{ stroke: charts.grid }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: charts.tick }}
                  width={64}
                  axisLine={{ stroke: charts.grid }}
                  tickFormatter={(v) =>
                    Math.abs(Number(v)) >= 1_000_000
                      ? `${(Number(v) / 1_000_000).toFixed(0)} млн`
                      : String(v)
                  }
                />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v ?? 0))}
                  contentStyle={{
                    background: charts.tooltipBg,
                    border: `1px solid ${charts.tooltipBorder}`,
                    borderRadius: 2,
                    color: charts.tick,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: charts.tick }} />
                <Bar
                  dataKey="Годовой эффект"
                  fill={charts.effect}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey={chartCapexKey}
                  fill={charts.capex}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey={chartOpexKey}
                  fill={charts.opex}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </details>
      </Card>

      <Card
          title="Анализ «что если»"
          subtitle="Сдвиньте ползунок — таблица сценариев пересчитается"
          actions={
            <Button variant="outline" size="sm" onClick={resetWhatIf} disabled={!whatIfDirty}>
              <RotateCcw className="h-4 w-4" />
              Сбросить
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
            <Slider
              label="Загрузка оборудования"
              source={whatIf.utilization !== DEFAULT_WHAT_IF.utilization ? 'user' : undefined}
              value={whatIf.utilization}
              min={40}
              max={100}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, utilization: v }))}
            />
            <Slider
              label="Резерв парка"
              source={whatIf.reserve !== DEFAULT_WHAT_IF.reserve ? 'user' : undefined}
              value={whatIf.reserve}
              min={0}
              max={40}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, reserve: v }))}
            />
            <Slider
              label="Горизонт анализа"
              source={whatIf.years !== DEFAULT_WHAT_IF.years ? 'user' : undefined}
              value={whatIf.years}
              min={3}
              max={10}
              unit=" лет"
              onChange={(v) => setWhatIf((p) => ({ ...p, years: v }))}
            />
            <Slider
              label="Снижение затрат на труд"
              source={
                whatIf.labor_reduction_share !== DEFAULT_WHAT_IF.labor_reduction_share
                  ? 'user'
                  : undefined
              }
              value={whatIf.labor_reduction_share}
              min={10}
              max={80}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, labor_reduction_share: v }))}
            />
            <Slider
              label="Изменение цены единицы"
              source={whatIf.unit_price_factor !== 0 ? 'user' : undefined}
              value={whatIf.unit_price_factor}
              min={-30}
              max={30}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, unit_price_factor: v }))}
            />
            <Slider
              label="Изменение пикового спроса"
              source={whatIf.peak_demand_factor !== 0 ? 'user' : undefined}
              value={whatIf.peak_demand_factor}
              min={-30}
              max={30}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, peak_demand_factor: v }))}
            />
            <Slider
              label="Изменение стоимости труда (ФОТ/год)"
              source={whatIf.labor_cost_factor !== 0 ? 'user' : undefined}
              value={whatIf.labor_cost_factor}
              min={-30}
              max={30}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, labor_cost_factor: v }))}
            />
            </div>
            {(whatIfMut.isPending || sensitivityMut.isPending) && (
              <p className="text-xs text-[var(--nc-muted)]">Пересчёт…</p>
            )}
            {(basePurchase || altPurchase) && (
              <div className="overflow-x-auto rounded border border-[var(--nc-border)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--nc-surface-muted)] text-xs uppercase text-[var(--nc-muted)]">
                    <tr>
                      <th className="px-3 py-2">Показатель</th>
                      <th className="px-3 py-2">База</th>
                      <th className="px-3 py-2">Новое</th>
                      <th className="px-3 py-2">Δ %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['Капитальные затраты', 'capex', true],
                        ['Эксплуатация / год', 'opex_yearly', true],
                        ['Годовой эффект', 'annual_effect', true],
                        ['Окупаемость', 'payback_years', false],
                      ] as const
                    ).map(([title, key, money]) => {
                      const b = kpiValue(basePurchase, key)
                      const n = kpiValue(altPurchase || basePurchase, key)
                      const isPayback = key === 'payback_years'
                      return (
                        <tr key={key} className="border-t border-[var(--nc-border-subtle)]">
                          <td className="px-3 py-2 text-[var(--nc-text)]">{title}</td>
                          <td className="px-3 py-2 font-medium tabular-nums">
                            {isPayback
                              ? kpiPaybackDisplay(basePurchase)
                              : b == null
                                ? '—'
                                : money
                                  ? formatCurrency(b)
                                  : formatNumber(b, 1)}
                          </td>
                          <td className="px-3 py-2 font-medium tabular-nums">
                            {isPayback
                              ? kpiPaybackDisplay(altPurchase || basePurchase)
                              : n == null
                                ? '—'
                                : money
                                  ? formatCurrency(n)
                                  : formatNumber(n, 1)}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{deltaPct(b, n)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

      {(sensitivityByParam.unit_price?.length ||
        sensitivityByParam.peak_demand?.length ||
        sensitivityByParam.current_labor_cost_year?.length) && (
        <details className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-[var(--nc-ink)]">
            Анализ чувствительности
          </summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <SensitivityChart
              title="Стоимость оборудования"
              data={sensitivityByParam.unit_price || []}
              formatX={(v) => formatCurrency(Number(v))}
              labelX={(l) => `Цена ${formatCurrency(Number(l))}`}
            />
            <SensitivityChart
              title="Объём операций (пик)"
              data={sensitivityByParam.peak_demand || []}
              formatX={(v) => formatNumber(Number(v), 0)}
              labelX={(l) => `Спрос ${formatNumber(Number(l), 0)}`}
            />
            <SensitivityChart
              title="Стоимость труда"
              data={sensitivityByParam.current_labor_cost_year || []}
              formatX={(v) => formatCurrency(Number(v))}
              labelX={(l) => `ФОТ ${formatCurrency(Number(l))}`}
            />
          </div>
        </details>
      )}
        </>
      )}

      <Modal open={explainOpen} onClose={() => setExplainOpen(false)} title="Как рассчитано" size="lg">
        <div className="space-y-4 text-sm text-[var(--nc-text)]">
          {explainSteps ? (
            explainSteps.map((step, i) => (
              <div key={i} className="rounded-lg border border-[var(--nc-border)] p-3">
                <p className="font-semibold text-[var(--nc-ink)]">
                  {i + 1}. {step.title || 'Шаг'}
                </p>
                {step.description && <p className="mt-1 text-[var(--nc-text)]">{step.description}</p>}
                {step.formula && (
                  <p className="mt-1 font-mono text-xs text-[var(--nc-link)]">{step.formula}</p>
                )}
                {step.value != null && (
                  <p className="mt-1 text-[var(--nc-ink)]">Результат: {String(step.value)}</p>
                )}
              </div>
            ))
          ) : (
            <>
              <p className="text-[var(--nc-muted)]">
                Подробное пошаговое объяснение недоступно — показаны формулы и разбивка последнего расчёта.
              </p>
              {(formulaEntries.length
                ? formulaEntries
                : [
                    {
                      name: 'Капитальные затраты',
                      expression: 'оборудование + инфраструктура + ПО + интеграция',
                      description: '',
                    },
                  ]
              ).map((f) => (
                <div key={f.name} className="rounded-lg border border-[var(--nc-border)] p-3">
                  <p className="font-semibold text-[var(--nc-ink)]">{formulaLabel(f.name)}</p>
                  <p className="mt-1 font-mono text-xs text-[var(--nc-link)]">{f.expression}</p>
                </div>
              ))}
              {breakdownEntries.length > 0 && (
                <div className="rounded-lg border border-[var(--nc-border)] p-3">
                  <p className="mb-2 font-semibold text-[var(--nc-ink)]">Разбивка последнего расчёта</p>
                  <dl className="space-y-1">
                    {breakdownEntries.map((b) => (
                      <div key={`${b.group}-${b.key}`} className="flex justify-between gap-3">
                        <dt className="text-[var(--nc-muted)]">
                          {b.group}: {breakdownLabel(b.key)}
                        </dt>
                        <dd className="font-medium">
                          {typeof b.value === 'number' ? formatCurrency(b.value) : String(b.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </>
          )}
          {formulasQuery.data?.description && (
            <p className="text-[var(--nc-muted)]">{formulasQuery.data.description}</p>
          )}
        </div>
      </Modal>
    </div>
  )
}

function SensitivityChart({
  title,
  data,
  formatX,
  labelX,
}: {
  title: string
  data: SensitivityPoint[]
  formatX: (v: number | string) => string
  labelX: (l: unknown) => string
}) {
  const charts = useChartTheme()
  if (!data.length) return null
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[var(--nc-text)]">{title}</p>
      <div className="h-64 rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="2 6" stroke={charts.grid} vertical={false} />
            <XAxis
              dataKey="value"
              tick={{ fontSize: 10, fill: charts.tick }}
              tickFormatter={(v) => formatX(v as number | string)}
              axisLine={{ stroke: charts.grid }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: charts.tick }}
              axisLine={{ stroke: charts.grid }}
              tickFormatter={(v) =>
                Math.abs(Number(v)) >= 1_000_000
                  ? `${(Number(v) / 1_000_000).toFixed(1)} млн`
                  : String(v)
              }
            />
            <Tooltip
              formatter={(v) => formatCurrency(Number(v ?? 0))}
              labelFormatter={(l) => labelX(l)}
              contentStyle={{
                background: charts.tooltipBg,
                border: `1px solid ${charts.tooltipBorder}`,
                borderRadius: 2,
                color: charts.tick,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: charts.tick }} />
            <Line
              type="monotone"
              dataKey="annual_effect"
              name="Годовой эффект"
              stroke={charts.effect}
              strokeWidth={2.5}
              dot={{ r: 3, fill: charts.effect }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="tco"
              name="Совокупная стоимость"
              stroke={charts.tco}
              strokeWidth={2.5}
              dot={{ r: 3, fill: charts.tco }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Kpi({
  title,
  value,
  hint,
  unit,
}: {
  title: string
  value: string
  hint?: string
  unit?: string
}) {
  return (
    <div className="nc-panel px-3 py-2.5">
      <p className="text-[11px] text-[var(--nc-muted)]">{title}</p>
      <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-[var(--nc-ink)]">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-[var(--nc-muted)]">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--nc-muted)]">{hint}</p> : null}
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  source,
}: {
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (v: number) => void
  source?: 'assumption' | 'user'
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-[var(--nc-text)]">
          {label}
          {source === 'user' && (
            <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--nc-accent)]">
              изменено
            </span>
          )}
        </span>
        <span className="font-medium text-[var(--nc-ink)]">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-700"
      />
    </label>
  )
}
