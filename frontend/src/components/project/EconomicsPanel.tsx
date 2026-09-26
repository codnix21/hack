import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
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
import { getFriendlyError } from '../../api/client'
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
import { formatCurrency, formatNumber, formatPercent } from '../../utils/format'
import { assumptionLabel, breakdownLabel, formulaLabel, valueSourceLabel } from '../../utils/labels'
import { toastError, toastSuccess } from '../../store/toastStore'

interface EconomicsPanelProps {
  projectId: string
  /** economics — расчёт покупки и разбивка; scenarios — сравнение 3 сценариев + what-if */
  mode?: 'economics' | 'scenarios'
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
}

const DEFAULT_WHAT_IF: WhatIfSliders = {
  utilization: 85,
  reserve: 10,
  years: 5,
  labor_reduction_share: 40,
  unit_price_factor: 0,
  peak_demand_factor: 0,
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
  if (key === 'payback_years') return r.payback?.payback_years ?? null
  return null
}

function scenarioRow(r: EconomicsScenarioResult) {
  return {
    id: r.scenario,
    name: r.scenario_name_ru || SCENARIO_LABELS[r.scenario] || r.scenario,
    capex: r.capex?.capex ?? 0,
    opex_yearly: r.opex?.opex_annual ?? 0,
    annual_effect: r.annual_effect?.annual_effect ?? 0,
    payback_years: r.payback?.payback_years ?? null,
    roi: r.roi?.roi_percent ?? null,
    tco: r.tco?.tco ?? 0,
    robots_count: r.robots_count ?? 0,
  }
}

export function EconomicsPanel({ projectId, mode = 'scenarios' }: EconomicsPanelProps) {
  const isEconomics = mode === 'economics'
  const isScenarios = mode === 'scenarios'
  const [whatIf, setWhatIf] = useState<WhatIfSliders>({ ...DEFAULT_WHAT_IF })
  const [scenarios, setScenarios] = useState<ReturnType<typeof scenarioRow>[]>([])
  const [assumptions, setAssumptions] = useState<Record<string, number | string | boolean>>({})
  const [lastResult, setLastResult] = useState<EconomicsScenarioResult | null>(null)
  const [basePurchase, setBasePurchase] = useState<EconomicsScenarioResult | null>(null)
  const [altPurchase, setAltPurchase] = useState<EconomicsScenarioResult | null>(null)
  const [baseUnitPrice, setBaseUnitPrice] = useState(3_500_000)
  const [basePeakDemand, setBasePeakDemand] = useState(200)
  const [sensitivityByParam, setSensitivityByParam] = useState<
    Record<string, SensitivityPoint[]>
  >({})
  const [altDelta, setAltDelta] = useState<Record<string, number> | null>(null)
  const [explainOpen, setExplainOpen] = useState(false)
  const [explainData, setExplainData] = useState<EconomicsExplainResponse | null>(null)

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
      setScenarios(results.map(scenarioRow))
      const purchase = results.find((r) => r.scenario === 'purchase')
      if (purchase) {
        setLastResult(purchase)
        setBasePurchase(purchase)
        setAltPurchase(null)
        setAltDelta(null)
        if (purchase.assumptions) setAssumptions(purchase.assumptions)
        const up = Number(purchase.assumptions?.unit_price)
        if (!Number.isNaN(up) && up > 0) setBaseUnitPrice(up)
        const peak = Number(purchase.assumptions?.peak_demand)
        if (!Number.isNaN(peak) && peak > 0) setBasePeakDemand(peak)
      }
      toastSuccess('Экономика рассчитана')
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  useEffect(() => {
    calcAllMut.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const whatIfMut = useMutation({
    mutationFn: () => {
      const unitPrice = baseUnitPrice * (1 + whatIf.unit_price_factor / 100)
      const peakDemand = basePeakDemand * (1 + whatIf.peak_demand_factor / 100)
      return economicsApi.whatIf(projectId, {
        base: { ...baseRequest, scenario: 'purchase' },
        changes: {
          utilization: whatIf.utilization / 100,
          reserve: whatIf.reserve / 100,
          years: whatIf.years,
          labor_reduction_share: whatIf.labor_reduction_share / 100,
          unit_price: unitPrice,
          peak_demand: peakDemand,
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
      const [util, price, peak] = await Promise.all([
        economicsApi.sensitivity(projectId, {
          base,
          parameter: 'utilization',
          values: [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0],
        }),
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
      ])
      return {
        utilization: util.rows || [],
        unit_price: price.rows || [],
        peak_demand: peak.rows || [],
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
  }, [whatIf, projectId, baseUnitPrice, basePeakDemand])

  const openExplain = async () => {
    setExplainOpen(true)
    const explained = await economicsApi.explain(projectId, { ...baseRequest, scenario: 'purchase' })
    setExplainData(explained)
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
      <div className="space-y-3">
        <p className="text-sm text-red-600">{getFriendlyError(calcAllMut.error)}</p>
        <Button onClick={() => calcAllMut.mutate()}>
          <Play className="h-4 w-4" />
          Повторить расчёт
        </Button>
      </div>
    )
  }

  const best = scenarios.reduce<(typeof scenarios)[0] | null>((acc, s) => {
    if (s.id === 'baseline') return acc
    if (!acc) return s
    return (s.annual_effect || 0) > (acc.annual_effect || 0) ? s : acc
  }, null)

  const chartData = scenarios.map((s) => ({
    name: s.name,
    'Годовой эффект': s.annual_effect,
    CAPEX: s.capex,
    OPEX: s.opex_yearly,
  }))

  const formulaEntries = Object.entries(formulasQuery.data?.formulas || {}).map(
    ([name, expression]) => ({ name, expression, description: '' }),
  )

  const explainSteps =
    explainData?.steps && Array.isArray(explainData.steps) ? explainData.steps : null

  const breakdownEntries = lastResult
    ? [
        ...Object.entries(lastResult.capex?.breakdown || {}).map(([k, v]) => ({
          group: 'CAPEX',
          key: k,
          value: v,
        })),
        ...Object.entries(lastResult.opex?.breakdown || {}).map(([k, v]) => ({
          group: 'OPEX',
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
    <div className="space-y-5">
      <p className="text-sm text-steel-600">
        {isEconomics
          ? 'Расчёт экономики для сценария «Покупка»: состав CAPEX/OPEX, допущения и формулы. Сравнение вариантов и «что если» — на вкладке «Анализ сценариев».'
          : 'Сравнение трёх сценариев (без роботизации / покупка / RaaS), анализ «что если» и чувствительность. Детальная разбивка покупки — на вкладке «Экономика».'}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button loading={calcAllMut.isPending} onClick={() => calcAllMut.mutate()}>
          <Play className="h-4 w-4" />
          {isEconomics ? 'Рассчитать экономику' : 'Пересчитать сценарии'}
        </Button>
        <Button variant="outline" onClick={openExplain}>
          <Info className="h-4 w-4" />
          Как рассчитано
        </Button>
      </div>

      {isEconomics && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              title="Роботов"
              value={lastResult?.robots_count != null ? formatNumber(lastResult.robots_count) : 'Нет данных'}
              hint="Расчётное количество для пикового спроса"
            />
            <Kpi
              title="CAPEX"
              value={
                lastResult?.capex?.capex != null
                  ? formatCurrency(lastResult.capex.capex)
                  : 'Нет данных'
              }
              hint="Первоначальные капитальные затраты"
            />
            <Kpi
              title="OPEX / год"
              value={
                lastResult?.opex?.opex_annual != null
                  ? formatCurrency(lastResult.opex.opex_annual)
                  : 'Нет данных'
              }
              hint="Эксплуатационные затраты в год"
            />
            <Kpi
              title="Срок окупаемости"
              value={
                lastResult?.payback?.payback_years != null
                  ? formatNumber(lastResult.payback.payback_years, 1)
                  : 'Недостаточно данных для расчёта'
              }
              unit={lastResult?.payback?.payback_years != null ? 'лет' : undefined}
              hint="Ориентировочный период возврата инвестиций"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              title="Годовой эффект"
              value={formatCurrency(lastResult?.annual_effect?.annual_effect)}
              hint="Ожидаемый чистый эффект за год"
            />
            <Kpi
              title="ROI"
              value={
                lastResult?.roi?.roi_percent != null
                  ? formatPercent(Number(lastResult.roi.roi_percent))
                  : 'Нет данных'
              }
              hint="Возврат инвестиций относительно CAPEX"
            />
            <Kpi
              title="TCO"
              value={
                lastResult?.tco?.tco != null ? formatCurrency(lastResult.tco.tco) : 'Нет данных'
              }
              hint="Совокупная стоимость владения"
            />
            <Kpi
              title="Сценарий"
              value="Покупка оборудования"
              hint="Основной сценарий этой вкладки"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Состав CAPEX">
              {Object.keys(lastResult?.capex?.breakdown || {}).length === 0 ? (
                <p className="text-sm text-steel-500">Запустите расчёт.</p>
              ) : (
                <dl className="space-y-2 text-sm">
                  {Object.entries(lastResult!.capex!.breakdown!).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-4 border-b border-steel-100 py-1.5"
                    >
                      <dt className="text-steel-500">{breakdownLabel(k)}</dt>
                      <dd className="font-medium text-steel-800">
                        {typeof v === 'number' ? formatCurrency(v) : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
            <Card title="Состав OPEX / год">
              {Object.keys(lastResult?.opex?.breakdown || {}).length === 0 ? (
                <p className="text-sm text-steel-500">Запустите расчёт.</p>
              ) : (
                <dl className="space-y-2 text-sm">
                  {Object.entries(lastResult!.opex!.breakdown!).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-4 border-b border-steel-100 py-1.5"
                    >
                      <dt className="text-steel-500">{breakdownLabel(k)}</dt>
                      <dd className="font-medium text-steel-800">
                        {typeof v === 'number' ? formatCurrency(v) : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
          </div>

          <Card title="Допущения модели">
            <p className="mb-3 text-xs text-steel-500">
              {valueSourceLabel('assumption')} — значения по умолчанию. Изменить ключевые параметры
              можно во вкладке «Анализ сценариев».
            </p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(assumptions)
                .slice(0, 16)
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-4 border-b border-steel-100 py-1.5"
                  >
                    <dt className="text-steel-500">{assumptionLabel(k)}</dt>
                    <dd className="font-medium text-steel-800">{String(v)}</dd>
                  </div>
                ))}
              {Object.keys(assumptions).length === 0 && (
                <p className="text-steel-500 sm:col-span-2">Запустите расчёт.</p>
              )}
            </dl>
          </Card>
        </>
      )}

      {isScenarios && (
        <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="Лучший сценарий"
          value={best?.name || 'Нет данных'}
          hint="Сценарий с наибольшим годовым эффектом"
        />
        <Kpi
          title="CAPEX"
          value={best?.capex != null ? formatCurrency(best.capex) : 'Нет данных'}
          hint="Первоначальные капитальные затраты"
        />
        <Kpi
          title="OPEX"
          value={best?.opex_yearly != null ? formatCurrency(best.opex_yearly) : 'Нет данных'}
          hint="Эксплуатационные затраты в год"
        />
        <Kpi
          title="Срок окупаемости"
          value={
            best?.payback_years != null
              ? formatNumber(best.payback_years, 1)
              : 'Недостаточно данных для расчёта'
          }
          unit={best?.payback_years != null ? 'лет' : undefined}
          hint="Ориентировочный период возврата инвестиций"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="TCO"
          value={best?.tco != null ? formatCurrency(best.tco) : 'Нет данных'}
          hint="Совокупная стоимость владения"
        />
        <Kpi
          title="ROI"
          value={best?.roi != null ? formatPercent(Number(best.roi)) : 'Нет данных'}
          hint="Возврат инвестиций относительно CAPEX"
        />
        <Kpi
          title="Годовой эффект"
          value={formatCurrency(best?.annual_effect)}
          hint="Ожидаемый чистый эффект за год"
        />
        <Kpi
          title="Изменение CAPEX (что если)"
          value={altDelta ? formatCurrency(altDelta.capex) : 'Нет данных'}
          hint="Разница после анализа «что если»"
        />
      </div>

      <Card title="Сравнение сценариев">
        <Table
          columns={[
            { key: 'name', header: 'Сценарий', render: (s) => s.name },
            { key: 'robots', header: 'Роботов', render: (s) => s.robots_count },
            { key: 'capex', header: 'CAPEX', render: (s) => formatCurrency(s.capex) },
            { key: 'opex', header: 'OPEX / год', render: (s) => formatCurrency(s.opex_yearly) },
            {
              key: 'effect',
              header: 'Годовой эффект',
              render: (s) => formatCurrency(s.annual_effect),
            },
            {
              key: 'roi',
              header: 'ROI',
              render: (s) => (s.roi != null ? formatPercent(Number(s.roi)) : '—'),
            },
            {
              key: 'payback',
              header: 'Окупаемость, лет',
              render: (s) =>
                s.payback_years != null ? formatNumber(s.payback_years, 1) : '—',
            },
            { key: 'tco', header: 'TCO', render: (s) => formatCurrency(s.tco) },
          ]}
          rows={scenarios}
          rowKey={(s) => s.id}
        />
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d5dae2" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
              <Legend />
              <Bar dataKey="Годовой эффект" fill="#2f5d8c" />
              <Bar dataKey="CAPEX" fill="#667690" />
              <Bar dataKey="OPEX" fill="#8fb6d6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Допущения">
          <p className="mb-3 text-xs text-steel-500">
            {valueSourceLabel('assumption')} — значения модели по умолчанию. После «что если» часть
            параметров помечается как «{valueSourceLabel('user')}».
          </p>
          <dl className="space-y-2 text-sm">
            {Object.entries(assumptions)
              .slice(0, 12)
              .map(([k, v]) => {
                const userKeys = new Set([
                  'utilization',
                  'reserve',
                  'years',
                  'labor_reduction_share',
                  'unit_price',
                  'peak_demand',
                ])
                const source = whatIfDirty && userKeys.has(k) ? 'user' : 'assumption'
                return (
                  <div key={k} className="flex justify-between gap-4 border-b border-steel-100 py-1.5">
                    <dt className="text-steel-500">
                      {assumptionLabel(k)}
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-steel-400">
                        {valueSourceLabel(source)}
                      </span>
                    </dt>
                    <dd className="font-medium text-steel-800">{String(v)}</dd>
                  </div>
                )
              })}
            {Object.keys(assumptions).length === 0 && (
              <p className="text-steel-500">Запустите расчёт, чтобы увидеть допущения.</p>
            )}
          </dl>
        </Card>

        <Card
          title="Анализ «что если»"
          subtitle="Изменения пересчитываются автоматически"
          actions={
            <Button variant="outline" size="sm" onClick={resetWhatIf} disabled={!whatIfDirty}>
              <RotateCcw className="h-4 w-4" />
              Сбросить изменения
            </Button>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-steel-500">
              Ползунки — «{valueSourceLabel('user')}». Исходные значения модели — «
              {valueSourceLabel('assumption')}».
            </p>
            <Slider
              label="Загрузка оборудования"
              source={whatIf.utilization !== DEFAULT_WHAT_IF.utilization ? 'user' : 'assumption'}
              value={whatIf.utilization}
              min={40}
              max={100}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, utilization: v }))}
            />
            <Slider
              label="Резерв парка"
              source={whatIf.reserve !== DEFAULT_WHAT_IF.reserve ? 'user' : 'assumption'}
              value={whatIf.reserve}
              min={0}
              max={40}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, reserve: v }))}
            />
            <Slider
              label="Горизонт анализа"
              source={whatIf.years !== DEFAULT_WHAT_IF.years ? 'user' : 'assumption'}
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
                  : 'assumption'
              }
              value={whatIf.labor_reduction_share}
              min={10}
              max={80}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, labor_reduction_share: v }))}
            />
            <Slider
              label="Изменение цены единицы"
              source={whatIf.unit_price_factor !== 0 ? 'user' : 'assumption'}
              value={whatIf.unit_price_factor}
              min={-30}
              max={30}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, unit_price_factor: v }))}
            />
            <Slider
              label="Изменение пикового спроса"
              source={whatIf.peak_demand_factor !== 0 ? 'user' : 'assumption'}
              value={whatIf.peak_demand_factor}
              min={-30}
              max={30}
              unit="%"
              onChange={(v) => setWhatIf((p) => ({ ...p, peak_demand_factor: v }))}
            />
            {(whatIfMut.isPending || sensitivityMut.isPending) && (
              <p className="text-xs text-steel-500">Пересчёт…</p>
            )}
            {(basePurchase || altPurchase || altDelta) && (
              <div className="overflow-x-auto rounded-lg border border-steel-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-steel-50 text-xs uppercase text-steel-500">
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
                        ['CAPEX', 'capex', true],
                        ['OPEX / год', 'opex_yearly', true],
                        ['Годовой эффект', 'annual_effect', true],
                        ['TCO', 'tco', true],
                        ['ROI', 'roi', false],
                        ['Окупаемость, лет', 'payback_years', false],
                      ] as const
                    ).map(([title, key, money]) => {
                      const b = kpiValue(basePurchase, key)
                      const n = kpiValue(altPurchase || basePurchase, key)
                      return (
                        <tr key={key} className="border-t border-steel-100">
                          <td className="px-3 py-2 text-steel-700">{title}</td>
                          <td className="px-3 py-2 font-medium">
                            {b == null ? '—' : money ? formatCurrency(b) : formatNumber(b, 1)}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {n == null ? '—' : money ? formatCurrency(n) : formatNumber(n, 1)}
                          </td>
                          <td className="px-3 py-2">{deltaPct(b, n)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {altDelta && (
              <dl className="space-y-1 text-sm text-steel-700">
                <div className="flex justify-between">
                  <dt>Δ CAPEX</dt>
                  <dd>{formatCurrency(altDelta.capex)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Δ OPEX</dt>
                  <dd>{formatCurrency(altDelta.opex_annual)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Δ годовой эффект</dt>
                  <dd>{formatCurrency(altDelta.annual_effect)}</dd>
                </div>
              </dl>
            )}
          </div>
        </Card>
      </div>

      {(sensitivityByParam.utilization?.length ||
        sensitivityByParam.unit_price?.length ||
        sensitivityByParam.peak_demand?.length) && (
        <Card title="Анализ чувствительности">
          <div className="grid gap-6 lg:grid-cols-3">
            <SensitivityChart
              title="Загрузка"
              data={sensitivityByParam.utilization || []}
              formatX={(v) => `${Math.round(Number(v) * 100)}%`}
              labelX={(l) => `Загрузка ${Math.round(Number(l) * 100)}%`}
            />
            <SensitivityChart
              title="Цена единицы"
              data={sensitivityByParam.unit_price || []}
              formatX={(v) => formatCurrency(Number(v))}
              labelX={(l) => `Цена ${formatCurrency(Number(l))}`}
            />
            <SensitivityChart
              title="Пиковый спрос"
              data={sensitivityByParam.peak_demand || []}
              formatX={(v) => formatNumber(Number(v), 0)}
              labelX={(l) => `Спрос ${formatNumber(Number(l), 0)}`}
            />
          </div>
        </Card>
      )}
        </>
      )}

      <Modal open={explainOpen} onClose={() => setExplainOpen(false)} title="Как рассчитано" size="lg">
        <div className="space-y-4 text-sm text-steel-700">
          {explainSteps ? (
            explainSteps.map((step, i) => (
              <div key={i} className="rounded-lg border border-steel-200 p-3">
                <p className="font-semibold text-steel-900">
                  {i + 1}. {step.title || 'Шаг'}
                </p>
                {step.description && <p className="mt-1 text-steel-600">{step.description}</p>}
                {step.formula && (
                  <p className="mt-1 font-mono text-xs text-brand-800">{step.formula}</p>
                )}
                {step.value != null && (
                  <p className="mt-1 text-steel-800">Результат: {String(step.value)}</p>
                )}
              </div>
            ))
          ) : (
            <>
              <p className="text-steel-500">
                Подробное пошаговое объяснение недоступно — показаны формулы и разбивка последнего расчёта.
              </p>
              {(formulaEntries.length
                ? formulaEntries
                : [
                    {
                      name: 'CAPEX',
                      expression: 'оборудование + инфраструктура + ПО + интеграция',
                      description: '',
                    },
                  ]
              ).map((f) => (
                <div key={f.name} className="rounded-lg border border-steel-200 p-3">
                  <p className="font-semibold text-steel-900">{formulaLabel(f.name)}</p>
                  <p className="mt-1 font-mono text-xs text-brand-800">{f.expression}</p>
                </div>
              ))}
              {breakdownEntries.length > 0 && (
                <div className="rounded-lg border border-steel-200 p-3">
                  <p className="mb-2 font-semibold text-steel-900">Разбивка последнего расчёта</p>
                  <dl className="space-y-1">
                    {breakdownEntries.map((b) => (
                      <div key={`${b.group}-${b.key}`} className="flex justify-between gap-3">
                        <dt className="text-steel-500">
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
            <p className="text-steel-500">{formulasQuery.data.description}</p>
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
  if (!data.length) return null
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-steel-700">{title}</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d5dae2" />
            <XAxis
              dataKey="value"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => formatX(v as number | string)}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v) => formatCurrency(Number(v ?? 0))}
              labelFormatter={(l) => labelX(l)}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="annual_effect"
              name="Годовой эффект"
              stroke="#2f5d8c"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="tco"
              name="TCO"
              stroke="#5a92c0"
              strokeWidth={2}
              dot={false}
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
    <div className="rounded border border-steel-200 bg-white p-4 shadow-panel">
      <p className="text-xs text-steel-500">{title}</p>
      <p className="mt-1 font-display text-xl font-semibold text-steel-900">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-steel-500">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-steel-500">{hint}</p> : null}
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
        <span className="text-steel-700">
          {label}
          {source && (
            <span className="ml-2 text-[10px] uppercase tracking-wide text-steel-400">
              {valueSourceLabel(source)}
            </span>
          )}
        </span>
        <span className="font-medium text-steel-900">
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
