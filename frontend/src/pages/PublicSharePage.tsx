import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Copy, LogIn } from 'lucide-react'
import { publicApi } from '../api/public'
import { getFriendlyError } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { formatCurrency, formatNumber, formatPercent } from '../utils/format'
import { metricLabel, workModeLabel } from '../utils/labels'
import { toastError, toastSuccess } from '../store/toastStore'
import { normalizeLayout } from '../api/economics'
import type { BackendLayout } from '../types'

export function PublicSharePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const authToken = useAuthStore((s) => s.token)
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest)

  const query = useQuery({
    queryKey: ['public', token],
    queryFn: () => publicApi.get(token),
    enabled: !!token,
    retry: false,
  })

  const cloneMut = useMutation({
    mutationFn: async () => {
      if (!authToken) {
        await continueAsGuest()
      }
      return publicApi.clone(token)
    },
    onSuccess: (p) => {
      toastSuccess('Копия создана — исходный проект не изменён')
      navigate(`/app/projects/${p.id}?step=report`)
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-sm text-steel-500">Загрузка презентации…</div>
    )
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <Card title="Публикация недоступна">
          <p className="text-sm text-steel-700">
            {getFriendlyError(query.error) ||
              'Ссылка недействительна, отозвана или проект удалён.'}
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-brand-700 hover:underline">
            На главную
          </Link>
        </Card>
      </div>
    )
  }

  const data = query.data!
  const p = data.project
  const e = data.economics
  const layout =
    data.layout && typeof data.layout === 'object'
      ? normalizeLayout(data.layout as BackendLayout)
      : null

  return (
    <div className="min-h-screen bg-steel-50">
      <header className="border-b border-steel-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-display text-lg font-semibold text-ink">NETCORE</p>
            <p className="text-xs text-steel-500">Публичная демонстрация · только просмотр</p>
          </div>
          <div className="flex gap-2">
            <Button loading={cloneMut.isPending} onClick={() => cloneMut.mutate()}>
              <Copy className="h-4 w-4" />
              Создать свою копию
            </Button>
            {!authToken && (
              <Link to="/login">
                <Button variant="outline">
                  <LogIn className="h-4 w-4" />
                  Войти
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        {data.disclaimer && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {data.disclaimer}
          </p>
        )}

        <section className="rounded border border-steel-200 bg-ink px-6 py-8 text-white">
          <h1 className="font-display text-3xl font-semibold">{p.name}</h1>
          <p className="mt-2 text-sm text-steel-300">{p.description || 'Демонстрация роботизации склада'}</p>
          <p className="mt-3 text-xs text-steel-400">
            {p.area_m2 != null ? `${formatNumber(p.area_m2, 0)} м²` : ''}
            {p.work_mode ? ` · ${workModeLabel(p.work_mode)}` : ''}
            {p.published_at
              ? ` · опубликовано ${new Date(p.published_at).toLocaleDateString('ru-RU')}`
              : ''}
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Склад">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-steel-500">Площадь</dt>
                <dd>{p.area_m2 != null ? `${formatNumber(p.area_m2, 0)} м²` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-steel-500">Пиковая нагрузка</dt>
                <dd>
                  {p.object_params?.peak_demand != null
                    ? `${p.object_params.peak_demand} оп/ч`
                    : '—'}
                </dd>
              </div>
            </dl>
          </Card>
          <Card title="Экономика">
            {e ? (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-steel-400">{metricLabel('capex')}</p>
                  <p className="font-semibold">
                    {formatCurrency((e.capex as { capex?: number })?.capex)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-steel-400">{metricLabel('opex_year')}</p>
                  <p className="font-semibold">
                    {formatCurrency((e.opex as { opex_annual?: number })?.opex_annual)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-steel-400">{metricLabel('annual_effect')}</p>
                  <p className="font-semibold">
                    {formatCurrency(
                      (e.annual_effect as { net_annual_effect?: number; annual_effect?: number })
                        ?.net_annual_effect ??
                        (e.annual_effect as { annual_effect?: number })?.annual_effect,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-steel-400">{metricLabel('roi')}</p>
                  <p className="font-semibold">
                    {(e.roi as { roi_percent?: number })?.roi_percent != null
                      ? formatPercent(Number((e.roi as { roi_percent: number }).roi_percent))
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-steel-400">Окупаемость</p>
                  <p className="font-semibold">
                    {(e.payback as { payback_years?: number })?.payback_years != null
                      ? `${formatNumber((e.payback as { payback_years: number }).payback_years, 1)} лет`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-steel-400">NPV</p>
                  <p className="font-semibold">
                    {(e.npv as { npv?: number })?.npv != null
                      ? formatCurrency((e.npv as { npv: number }).npv)
                      : '—'}
                  </p>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-steel-500">Расчёт ещё не выполнен автором</p>
            )}
          </Card>
        </div>

        {layout && (
          <Card title="План склада">
            <svg
              width="100%"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="max-h-80 rounded border border-steel-100 bg-white"
            >
              <rect width={layout.width} height={layout.height} fill="#f8fafc" />
              {layout.zones.map((z) => (
                <rect
                  key={z.id}
                  x={z.x}
                  y={z.y}
                  width={z.w}
                  height={z.h}
                  fill={z.color || '#cbd5e1'}
                  stroke="#64748b"
                />
              ))}
              {layout.routes.map((r) => (
                <polyline
                  key={r.id}
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth={2}
                  points={r.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                />
              ))}
            </svg>
          </Card>
        )}

        <Card title="Роботы">
          {data.selected_robots.length === 0 ? (
            <p className="text-sm text-steel-500">Список не опубликован</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.selected_robots.map((r, i) => (
                <li key={i} className="flex justify-between border-b border-steel-50 py-2">
                  <span>{r.name}</span>
                  <span className="text-steel-500">
                    {r.price_rub != null ? formatCurrency(r.price_rub) : r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  )
}
