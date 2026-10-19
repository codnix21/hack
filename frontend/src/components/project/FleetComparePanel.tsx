import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Play } from 'lucide-react'
import { economicsApi, type FleetCompareResponse } from '../../api/economics'
import { getFriendlyError } from '../../api/client'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { formatCurrency, formatPayback, formatPercent } from '../../utils/format'
import { toastError, toastSuccess } from '../../store/toastStore'

interface Props {
  projectId: string
}

export function FleetComparePanel({ projectId }: Props) {
  const [c1, setC1] = useState('4')
  const [c2, setC2] = useState('6')
  const [c3, setC3] = useState('8')
  const [data, setData] = useState<FleetCompareResponse | null>(null)

  const mut = useMutation({
    mutationFn: () => {
      const counts = [c1, c2, c3]
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= 200)
      if (counts.length < 2) throw new Error('Укажите минимум две конфигурации')
      return economicsApi.fleetCompare(projectId, { counts, persist: true })
    },
    onSuccess: (res) => {
      setData(res)
      toastSuccess(
        res.persisted
          ? 'Сравнение сохранено. Исходный расчёт сценария «Покупка» не изменён.'
          : 'Сравнение рассчитано (без записи — демо или нет прав)',
      )
    },
    onError: (e) => toastError(getFriendlyError(e) || String(e)),
  })

  useEffect(() => {
    mut.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const chart = (data?.rows || []).map((r) => ({
    name: r.name_ru,
    capex: r.economics?.capex?.capex ?? 0,
    effect: r.economics?.annual_effect?.annual_effect ?? 0,
    capacity: r.operations?.fleet_capacity_ops_per_hour ?? 0,
  }))

  return (
    <Card
      title="Сравнение конфигураций парка"
      subtitle="Один план и одни допущения · стартовый пример 4 / 6 / 8 роботов"
      actions={
        <Button loading={mut.isPending} onClick={() => mut.mutate()}>
          <Play className="h-4 w-4" />
          Пересчитать
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input label="Конфигурация A" type="number" value={c1} onChange={(e) => setC1(e.target.value)} />
        <Input label="Конфигурация B" type="number" value={c2} onChange={(e) => setC2(e.target.value)} />
        <Input label="Конфигурация C" type="number" value={c3} onChange={(e) => setC3(e.target.value)} />
      </div>

      {data?.insight && (
        <p className="mb-4 rounded border border-steel-200 bg-steel-50 px-3 py-2 text-sm text-steel-700">
          {data.insight}
        </p>
      )}

      {data && chart.length > 0 && (
        <div className="mb-5 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 12, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} height={40} />
              <YAxis
                tick={{ fontSize: 11 }}
                width={64}
                tickFormatter={(v) =>
                  Math.abs(Number(v)) >= 1_000_000
                    ? `${(Number(v) / 1_000_000).toFixed(0)}M`
                    : String(v)
                }
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="capex" name="Капитальные затраты (CAPEX)" fill="#ea580c" />
              <Bar dataKey="effect" name="Чистый эффект / год" fill="#0f766e" />
              <Bar dataKey="capacity" name="Производительность парка, оп/ч" fill="#64748b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="overflow-x-auto rounded border border-steel-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-steel-50 text-xs uppercase text-steel-500">
            <tr>
              <th className="px-3 py-2">Сценарий</th>
              <th className="px-3 py-2">Роботы</th>
              <th className="px-3 py-2">Покрытие пика</th>
              <th className="px-3 py-2">Загрузка</th>
              <th className="px-3 py-2">CAPEX</th>
              <th className="px-3 py-2">OPEX / год</th>
              <th className="px-3 py-2">Чистый эффект</th>
              <th className="px-3 py-2">ROI</th>
              <th className="px-3 py-2">Окупаемость</th>
              <th className="px-3 py-2">NPV</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((r) => {
              const e = r.economics
              const op = r.operations
              return (
                <tr key={r.code} className="border-t border-steel-100">
                  <td className="px-3 py-2 font-medium">{r.name_ru}</td>
                  <td className="px-3 py-2">{r.robots_count}</td>
                  <td className="px-3 py-2">
                    {op.peak_coverage != null
                      ? formatPercent(op.peak_coverage * 100)
                      : 'Нет данных'}
                    {op.meets_peak_demand === false ? (
                      <span className="ml-1 text-xs text-amber-700">недостаточно</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {op.utilization_estimate != null
                      ? formatPercent(op.utilization_estimate * 100)
                      : '—'}
                  </td>
                  <td className="px-3 py-2">{formatCurrency(e.capex?.capex)}</td>
                  <td className="px-3 py-2">{formatCurrency(e.opex?.opex_annual)}</td>
                  <td className="px-3 py-2">
                    {formatCurrency(
                      e.annual_effect?.net_annual_effect ?? e.annual_effect?.annual_effect,
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {e.roi?.roi_percent != null
                      ? formatPercent(Number(e.roi.roi_percent))
                      : typeof e.roi?.message === 'string'
                        ? 'Не прим.'
                        : '—'}
                  </td>
                  <td className="px-3 py-2">{formatPayback(e.payback)}</td>
                  <td className="px-3 py-2">
                    {(e as { npv?: { npv?: number } }).npv?.npv != null
                      ? formatCurrency((e as { npv: { npv: number } }).npv.npv)
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {(data?.rows || []).some((r) => r.operations?.estimated) && (
        <p className="mt-3 text-xs text-steel-500">
          Метрики покрытия/загрузки — оценочные по формуле парка, не телеметрия симуляции.
          {(data?.rows?.[0]?.operations?.note && ` ${data.rows[0].operations.note}`) || ''}
        </p>
      )}
    </Card>
  )
}
