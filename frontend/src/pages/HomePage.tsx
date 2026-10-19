import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, PlayCircle, Plus } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { projectsApi } from '../api/projects'
import { catalogApi } from '../api/catalog'
import { formatDate, PROJECT_STATUS_LABELS } from '../utils/format'
import { SkeletonCards } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { useMemo } from 'react'

function continueStep(p: { summary?: { robots_count?: number | null; capex?: number | null } | null }) {
  if (p.summary?.capex != null) return 'report'
  if (p.summary?.robots_count != null) return 'economics'
  return 'object'
}

/** Рабочий обзор внутри /app (не публичная визитка — см. LandingPage). */
export function HomePage() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    enabled: !!token,
  })

  const typesQuery = useQuery({
    queryKey: ['object-types'],
    queryFn: () => catalogApi.objectTypes(),
    enabled: !!token,
  })

  const typeMap = useMemo(() => {
    const m = new Map<number, string>()
    ;(typesQuery.data || []).forEach((o) => m.set(o.id, o.name_ru))
    return m
  }, [typesQuery.data])

  const recent = useMemo(() => {
    const list = [...(projectsQuery.data || [])]
    list.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    return list.slice(0, 6)
  }, [projectsQuery.data])

  const summaryLine = useMemo(() => {
    const all = projectsQuery.data || []
    if (!all.length) return null
    const withCapex = all.filter((p) => p.summary?.capex != null).length
    return `${all.length} проект(ов) · с расчётом: ${withCapex}`
  }, [projectsQuery.data])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="flex flex-col gap-4 border-b border-steel-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="nc-section-label text-brand-700">NETCORE</p>
          <h1 className="nc-title mt-1 text-balance">
            Предынвестиционная оценка роботизации склада
          </h1>
          <p className="nc-body mt-1.5 max-w-2xl text-pretty">
            От исходных данных к отчёту: планировка, подбор, экономика и демонстрационная модель.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Link
            to="/app/projects/new"
            className="nc-focusable inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded bg-brand-600 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-500"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Создать проект
          </Link>
          <Link
            to="/app/demo"
            className="nc-focusable inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded border border-steel-300 bg-white px-3.5 text-sm font-medium text-steel-800 transition hover:bg-steel-50"
          >
            <PlayCircle className="h-4 w-4 shrink-0" />
            Открыть пример
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="nc-title-sm">Продолжить работу</h2>
            {summaryLine ? (
              <p className="mt-0.5 text-xs text-steel-500">{summaryLine}</p>
            ) : (
              <p className="nc-body mt-0.5 text-xs">Недавние проекты</p>
            )}
          </div>
          <Link
            to="/app/projects"
            className="shrink-0 whitespace-nowrap text-sm font-medium text-brand-700 hover:underline"
          >
            Все проекты
          </Link>
        </div>
        {projectsQuery.isLoading && <SkeletonCards count={3} />}
        {projectsQuery.isError && (
          <p className="text-sm text-red-600">Не удалось загрузить проекты. Обновите страницу.</p>
        )}
        {!projectsQuery.isLoading && recent.length === 0 && (
          <EmptyState
            title="Проектов пока нет"
            description="Создайте свой объект или откройте демонстрационный склад."
            actionLabel="Создать проект"
            onAction={() => navigate('/app/projects/new')}
          />
        )}
        {recent.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map((p) => {
              const step = continueStep(p)
              const typeLabel =
                (p.object_type_id != null && typeMap.get(p.object_type_id)) || 'Тип не указан'
              return (
                <li key={p.id} className="min-w-0">
                  <Link
                    to={`/app/projects/${p.id}?step=${step}`}
                    className="nc-panel nc-focusable flex h-full min-w-0 flex-col gap-2.5 px-3.5 py-3 transition hover:border-brand-300"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <p
                        className="min-w-0 flex-1 text-sm font-medium leading-snug text-ink [overflow-wrap:anywhere]"
                        title={p.name}
                      >
                        {p.name}
                      </p>
                      <Badge
                        variant={p.is_demo ? 'warning' : 'default'}
                        className="shrink-0 self-start"
                      >
                        {p.is_demo ? 'Демо' : PROJECT_STATUS_LABELS[p.status] || p.status}
                      </Badge>
                    </div>
                    <div className="mt-auto flex min-w-0 items-center justify-between gap-3">
                      <p className="min-w-0 text-xs leading-snug text-steel-500 [overflow-wrap:anywhere]">
                        {typeLabel}
                        <span className="text-steel-300"> · </span>
                        {formatDate(p.updated_at)}
                      </p>
                      <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs font-medium text-brand-700">
                        Открыть
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="text-xs leading-relaxed text-steel-400">
        Гостевой проект сохраняется на срок сессии. Результат — предварительная оценка и требует
        проверки на объекте.
      </p>
    </div>
  )
}
