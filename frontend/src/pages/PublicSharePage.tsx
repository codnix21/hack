import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Copy, LogIn } from 'lucide-react'
import { publicApi } from '../api/public'
import { getFriendlyError } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'
import { Callout } from '../components/ui/Callout'
import { LoadingState } from '../components/ui/LoadingState'
import { ErrorState } from '../components/ui/ErrorState'
import { StatusPill } from '../components/ui/StatusPill'
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
      <div className="mx-auto max-w-4xl px-6 py-16">
        <LoadingState rows={8} label="Загрузка публикации…" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <div className="page-surface p-6">
          <ErrorState
            title="Публикация недоступна"
            description={
              getFriendlyError(query.error) ||
              'Ссылка недействительна, отозвана или проект удалён.'
            }
          />
          <Link to="/" className="mt-4 inline-block text-sm text-[var(--nc-link)] hover:underline">
            На главную
          </Link>
        </div>
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
    <div className="min-h-screen bg-[var(--nc-bg)]">
      <header className="border-b border-[var(--nc-border-subtle)] bg-[var(--nc-bg-elevated)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="font-display text-lg font-semibold uppercase tracking-wide text-[var(--nc-ink)]">
              NETCORE
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill tone="warning">Публичный просмотр</StatusPill>
              <span className="text-xs text-[var(--nc-muted)]">исходный проект не изменяется</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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

      <main className="mx-auto max-w-5xl space-y-4 px-6 py-8">
        {data.disclaimer ? (
          <Callout variant="warning" title="Ограничение публикации">
            {data.disclaimer}
          </Callout>
        ) : (
          <Callout variant="info" title="Только просмотр">
            Показан снимок, которым поделился автор. Для правок создайте копию.
          </Callout>
        )}

        <section className="nc-command-frame px-6 py-8 text-[var(--nc-ink)]">
          <h1 className="relative font-display text-2xl font-semibold sm:text-3xl [overflow-wrap:anywhere]">
            {p.name}
          </h1>
          <p className="relative mt-2 text-sm text-[var(--nc-text)]">
            {p.description || 'Публичная оценка роботизации'}
          </p>
          <p className="relative mt-3 font-mono text-xs text-[var(--nc-muted)]">
            {p.area_m2 != null ? `${formatNumber(p.area_m2, 0)} м²` : ''}
            {p.work_mode ? ` · ${workModeLabel(p.work_mode)}` : ''}
            {p.published_at
              ? ` · опубликовано ${new Date(p.published_at).toLocaleDateString('ru-RU')}`
              : ''}
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="page-surface space-y-3 p-4">
            <h2 className="font-display text-sm font-semibold text-[var(--nc-ink)]">Объект</h2>
            <dl className="space-y-2 text-sm text-[var(--nc-ink)]">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--nc-muted)]">Площадь</dt>
                <dd>{p.area_m2 != null ? `${formatNumber(p.area_m2, 0)} м²` : 'нет данных'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--nc-muted)]">Пиковая нагрузка</dt>
                <dd>
                  {p.object_params?.peak_demand != null
                    ? `${p.object_params.peak_demand} оп/ч`
                    : 'нет данных'}
                </dd>
              </div>
            </dl>
          </div>
          <div className="page-surface space-y-3 p-4">
            <h2 className="font-display text-sm font-semibold text-[var(--nc-ink)]">Экономика (снимок)</h2>
            {e ? (
              <dl className="grid grid-cols-2 gap-2 text-sm text-[var(--nc-ink)]">
                <div>
                  <p className="text-xs text-[var(--nc-muted)]">{metricLabel('capex')}</p>
                  <p className="font-semibold tabular-nums">
                    {formatCurrency((e.capex as { capex?: number })?.capex)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--nc-muted)]">{metricLabel('opex_year')}</p>
                  <p className="font-semibold tabular-nums">
                    {formatCurrency((e.opex as { opex_annual?: number })?.opex_annual)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--nc-muted)]">{metricLabel('annual_effect')}</p>
                  <p className="font-semibold tabular-nums">
                    {formatCurrency(
                      (e.annual_effect as { net_annual_effect?: number; annual_effect?: number })
                        ?.net_annual_effect ??
                        (e.annual_effect as { annual_effect?: number })?.annual_effect,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--nc-muted)]">{metricLabel('roi')}</p>
                  <p className="font-semibold tabular-nums">
                    {(e.roi as { roi_percent?: number })?.roi_percent != null
                      ? formatPercent(Number((e.roi as { roi_percent: number }).roi_percent))
                      : 'нет данных'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--nc-muted)]">Окупаемость</p>
                  <p className="font-semibold tabular-nums">
                    {(e.payback as { payback_years?: number })?.payback_years != null
                      ? `${formatNumber((e.payback as { payback_years: number }).payback_years, 1)} лет`
                      : 'нет данных'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--nc-muted)]">Чистая приведённая стоимость</p>
                  <p className="font-semibold tabular-nums">
                    {(e.npv as { npv?: number })?.npv != null
                      ? formatCurrency((e.npv as { npv: number }).npv)
                      : 'нет данных'}
                  </p>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-[var(--nc-muted)]">Расчёт ещё не выполнен автором</p>
            )}
          </div>
        </div>

        {layout && (
          <div className="page-surface space-y-3 p-4">
            <h2 className="font-display text-sm font-semibold text-[var(--nc-ink)]">План (схема)</h2>
            <svg
              width="100%"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="max-h-80 border border-[var(--nc-border)] bg-[var(--nc-canvas)]"
              role="img"
              aria-label="Схема плана склада"
            >
              <rect width={layout.width} height={layout.height} fill="#0d1016" />
              {layout.zones.map((z) => (
                <rect
                  key={z.id}
                  x={z.x}
                  y={z.y}
                  width={z.w}
                  height={z.h}
                  fill={z.color || '#3d4a60'}
                  stroke="#7a8aa3"
                />
              ))}
              {layout.routes.map((r) => (
                <polyline
                  key={r.id}
                  fill="none"
                  stroke="#ff8a2b"
                  strokeWidth={2}
                  points={r.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                />
              ))}
            </svg>
          </div>
        )}

        <div className="page-surface space-y-3 p-4">
          <h2 className="font-display text-sm font-semibold text-[var(--nc-ink)]">Роботы</h2>
          {data.selected_robots.length === 0 ? (
            <p className="text-sm text-[var(--nc-muted)]">Список не опубликован</p>
          ) : (
            <ul className="divide-y divide-[var(--nc-border-subtle)] text-sm text-[var(--nc-ink)]">
              {data.selected_robots.map((r, i) => (
                <li key={i} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{r.name}</span>
                  <span className="shrink-0 text-[var(--nc-muted)] tabular-nums">
                    {r.price_rub != null ? formatCurrency(r.price_rub) : r.status || 'нет цены'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
