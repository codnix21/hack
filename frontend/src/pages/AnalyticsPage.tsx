import { useQuery } from '@tanstack/react-query'
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
import { analyticsApi } from '../api/economics'
import { getFriendlyError } from '../api/client'
import type { AnalyticsSummary } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { formatCurrency, formatNumber } from '../utils/format'
import { matchStatusLabel } from '../utils/labels'

export function AnalyticsPage() {
  const query = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.summary() as Promise<AnalyticsSummary>,
  })

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (query.isError) {
    return <p className="text-sm text-red-600">{getFriendlyError(query.error)}</p>
  }

  const data = query.data!
  const matchingRows = Object.entries(data.matching_by_status || {}).map(([status, count]) => ({
    status: matchStatusLabel(status),
    count,
  }))

  return (
    <div>
      <PageHeader
        title="Аналитика"
        subtitle="Сводные показатели использования платформы"
        crumbs={[
          { label: 'Панель управления', to: '/app' },
          { label: 'Аналитика' },
        ]}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Всего проектов" value={formatNumber(data.projects_total)} />
        <Kpi title="Демо-проектов" value={formatNumber(data.demo_projects)} />
        <Kpi title="Решений в каталоге" value={formatNumber(data.robots_total)} />
        <Kpi title="Расчётов" value={formatNumber(data.calculations_total)} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Производителей" value={formatNumber(data.manufacturers_total)} />
        <Kpi title="Отраслей" value={formatNumber(data.industries_total)} />
        <Kpi title="Типов объектов" value={formatNumber(data.object_types_total)} />
        <Kpi
          title="Средняя цена робота"
          value={formatCurrency(data.avg_robot_price_rub)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Роботы по типу решения">
          {(data.robots_by_type || []).length === 0 ? (
            <EmptyState
              title="Нет данных для диаграммы"
              description="После импорта каталога здесь появится распределение по типам решений."
            />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.robots_by_type || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d5dae2" />
                  <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Количество" fill="#2f5d8c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Результаты подбора по статусу">
          {matchingRows.length === 0 ? (
            <EmptyState
              title="Нет данных подбора"
              description="Запустите подбор в демонстрационном или своём проекте."
            />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={matchingRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d5dae2" />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Количество" fill="#5a92c0" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded border border-steel-200 bg-white p-4 shadow-panel">
      <p className="text-xs text-steel-500">{title}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-steel-900">{value}</p>
    </div>
  )
}
