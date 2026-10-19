import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, FileSpreadsheet, FileText, Link2, Play, Share2 } from 'lucide-react'
import { economicsApi, matchingApi, visualizationApi } from '../../api/economics'
import { projectsApi } from '../../api/projects'
import { getFriendlyError } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { formatCurrency, formatNumber, formatPayback, formatPercent } from '../../utils/format'
import { matchStatusLabel, metricLabel, workModeLabel } from '../../utils/labels'
import { toastError, toastSuccess } from '../../store/toastStore'
import type { Project } from '../../types'

interface Props {
  project: Project
  projectId: string
  onEdit: () => void
  onSimulate: () => void
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function PresentationPanel({ project, projectId, onEdit, onSimulate }: Props) {
  const qc = useQueryClient()
  const isGuest = useAuthStore((s) => s.isGuest)
  const [shareUrl, setShareUrl] = useState(
    project.public_token && project.published_at
      ? `${window.location.origin}/p/${project.public_token}`
      : '',
  )

  const freshnessQuery = useQuery({
    queryKey: ['economics-freshness', projectId],
    queryFn: () => economicsApi.freshness(projectId),
    staleTime: 15_000,
  })
  const readinessQuery = useQuery({
    queryKey: ['inputs-readiness', projectId],
    queryFn: () => projectsApi.inputsReadiness(projectId),
    staleTime: 15_000,
  })
  const economicsReady = Boolean(
    (readinessQuery.data as { summary?: { economics_ready?: boolean } } | undefined)?.summary
      ?.economics_ready,
  )
  const exportBlocked =
    freshnessQuery.data?.status === 'stale' || freshnessQuery.data?.status === 'none'

  const econQuery = useQuery({
    queryKey: ['presentation-econ', projectId],
    queryFn: () => economicsApi.calculate(projectId, { scenario: 'purchase' }),
    enabled: economicsReady,
  })
  const matchQuery = useQuery({
    queryKey: ['presentation-match', projectId],
    queryFn: () => matchingApi.results(projectId),
  })
  const layoutQuery = useQuery({
    queryKey: ['presentation-layout', projectId],
    queryFn: () => visualizationApi.layout(projectId),
  })
  const fleetQuery = useQuery({
    queryKey: ['presentation-fleet', projectId],
    queryFn: () => economicsApi.fleetCompare(projectId, { persist: false }),
    enabled: economicsReady,
  })

  const econ = econQuery.data?.results
  const selected = useMemo(
    () => (matchQuery.data?.results || []).filter((r) => r.selected || r.status === 'suitable').slice(0, 5),
    [matchQuery.data],
  )

  const params = project.object_params || {}
  const layoutW =
    (project.layout as { width_m?: number } | null | undefined)?.width_m ?? params.area_width_m
  const layoutL =
    (project.layout as { length_m?: number } | null | undefined)?.length_m ?? params.area_length_m
  const area =
    layoutW != null && layoutL != null
      ? Number(layoutW) * Number(layoutL)
      : (project.summary?.area_m2 ?? null)

  const publishMut = useMutation({
    mutationFn: () => projectsApi.publish(projectId),
    onSuccess: (p) => {
      const url = `${window.location.origin}/p/${p.public_token}`
      setShareUrl(url)
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      toastSuccess('Проект опубликован')
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const unpublishMut = useMutation({
    mutationFn: () => projectsApi.unpublish(projectId),
    onSuccess: () => {
      setShareUrl('')
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      toastSuccess('Публикация отключена')
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const readOnly = Boolean(project.is_demo)

  return (
    <div className="space-y-5">
      <div className="rounded border border-steel-800 bg-ink px-6 py-7 text-white sm:px-7 sm:py-8">
        <p className="nc-section-label text-brand-400">Итог для руководства</p>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-snug break-words sm:text-3xl">
          {project.name}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-steel-300">
          {project.description || 'Предварительная оценка роботизации склада'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-steel-400">
          {area != null && <span>Площадь ≈ {formatNumber(area, 0)} м²</span>}
          {project.work_mode && <span>· Режим {workModeLabel(project.work_mode)}</span>}
          {project.region && <span>· {project.region}</span>}
          {isGuest && <Badge variant="warning">Гостевая сессия</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!readOnly && (
          <Button variant="outline" onClick={onEdit}>
            Вернуться к редактированию
          </Button>
        )}
        <Button variant="outline" onClick={onSimulate}>
          <Play className="h-4 w-4" />
          Запустить симуляцию
        </Button>
        <Button
          variant="outline"
          disabled={exportBlocked}
          title={
            exportBlocked
              ? 'Сначала выполните актуальный расчёт экономики'
              : undefined
          }
          onClick={async () => {
            if (exportBlocked) {
              toastError(
                freshnessQuery.data?.status === 'stale'
                  ? 'Экономика устарела — пересчитайте перед экспортом'
                  : 'Сначала выполните расчёт экономики',
              )
              return
            }
            try {
              const blob = await projectsApi.exportPdf(projectId)
              downloadBlob(blob, `${project.name}.pdf`)
              toastSuccess('PDF сформирован')
            } catch (e) {
              toastError(getFriendlyError(e))
            }
          }}
        >
          <FileText className="h-4 w-4" />
          Скачать PDF-отчёт
        </Button>
        <Button
          variant="outline"
          disabled={exportBlocked}
          title={
            exportBlocked
              ? 'Сначала выполните актуальный расчёт экономики'
              : undefined
          }
          onClick={async () => {
            if (exportBlocked) {
              toastError(
                freshnessQuery.data?.status === 'stale'
                  ? 'Экономика устарела — пересчитайте перед экспортом'
                  : 'Сначала выполните расчёт экономики',
              )
              return
            }
            try {
              const blob = await projectsApi.exportExcel(projectId)
              downloadBlob(blob, `${project.name}.xlsx`)
              toastSuccess('Excel сформирован')
            } catch (e) {
              toastError(getFriendlyError(e))
            }
          }}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Скачать Excel-отчёт
        </Button>
        {!readOnly && (
          <>
            <Button loading={publishMut.isPending} onClick={() => publishMut.mutate()}>
              <Share2 className="h-4 w-4" />
              Опубликовать проект
            </Button>
            {shareUrl && (
              <>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl)
                    toastSuccess('Ссылка скопирована')
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Скопировать ссылку
                </Button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded border border-steel-300 px-3 text-sm hover:bg-steel-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Открыть
                </a>
                <Button variant="ghost" loading={unpublishMut.isPending} onClick={() => unpublishMut.mutate()}>
                  Отключить публикацию
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {shareUrl && (
        <p className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Link2 className="h-4 w-4" />
          Публичная ссылка (только чтение): {shareUrl}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Параметры склада">
          <dl className="space-y-2 text-sm">
            <Row k="Площадь" v={area != null ? `${formatNumber(area, 0)} м²` : 'Не задана'} />
            <Row k="Ширина" v={params.area_width_m != null ? `${params.area_width_m} м` : '—'} />
            <Row k="Длина" v={params.area_length_m != null ? `${params.area_length_m} м` : '—'} />
            <Row
              k="Пиковая нагрузка"
              v={params.peak_demand != null ? `${params.peak_demand} оп/ч` : '—'}
            />
            <Row k="Проходы" v={params.aisle_width_mm != null ? `${params.aisle_width_mm} мм` : '—'} />
          </dl>
        </Card>

        <Card title="Ключевые показатели для решения">
          {econQuery.isLoading && <p className="text-sm text-steel-500">Расчёт…</p>}
          {econ && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Kpi label={metricLabel('robots_count')} value={formatNumber(econ.robots_count)} />
              <Kpi label={metricLabel('capex')} value={formatCurrency(econ.capex?.capex)} />
              <Kpi
                label={metricLabel('annual_effect')}
                value={formatCurrency(
                  econ.annual_effect?.net_annual_effect ?? econ.annual_effect?.annual_effect,
                )}
              />
              <Kpi label={metricLabel('payback')} value={formatPayback(econ.payback)} />
              <Kpi
                label={metricLabel('npv')}
                value={econ.npv?.npv != null ? formatCurrency(econ.npv.npv) : 'Нет данных'}
              />
              <Kpi
                label={metricLabel('opex_year')}
                value={formatCurrency(econ.opex?.opex_annual)}
              />
              <Kpi
                label={metricLabel('roi')}
                value={
                  econ.roi?.roi_percent != null
                    ? formatPercent(Number(econ.roi.roi_percent))
                    : 'Нет данных'
                }
              />
            </dl>
          )}
        </Card>
      </div>

      <Card title="План склада" subtitle="Вид сверху по сохранённой геометрии">
        {layoutQuery.data ? (
          <div className="overflow-auto rounded border border-steel-100 bg-steel-50 p-2">
            <MiniPlan layout={layoutQuery.data} />
          </div>
        ) : (
          <p className="text-sm text-steel-500">План загружается…</p>
        )}
      </Card>

      <Card title="Выбранные решения">
        {selected.length === 0 ? (
          <p className="text-sm text-steel-500">Запустите подбор и отметьте модели.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {selected.map((r) => (
              <li key={r.robot_id} className="flex justify-between border-b border-steel-50 py-2">
                <span className="font-medium">{r.robot_name || `#${r.robot_id}`}</span>
                <span className="text-steel-500">
                  {r.recommended_count != null
                    ? `${r.recommended_count} ед.`
                    : matchStatusLabel(r.status)}
                  {r.robot_price_rub != null ? ` · ${formatCurrency(r.robot_price_rub)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Сравнение альтернатив парка" subtitle="Оценочные конфигурации">
        {fleetQuery.data?.rows ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-steel-500">
                <tr>
                  <th className="px-2 py-1 text-left">Конфиг.</th>
                  <th className="px-2 py-1 text-left">CAPEX</th>
                  <th className="px-2 py-1 text-left">Годовой эффект</th>
                  <th className="px-2 py-1 text-left">Окупаемость</th>
                </tr>
              </thead>
              <tbody>
                {fleetQuery.data.rows.map((r) => (
                  <tr key={r.code} className="border-t border-steel-100">
                    <td className="px-2 py-1.5">{r.name_ru}</td>
                    <td className="px-2 py-1.5">{formatCurrency(r.economics.capex?.capex)}</td>
                    <td className="px-2 py-1.5">
                      {formatCurrency(r.economics.annual_effect?.annual_effect)}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.economics.payback?.payback_years != null ||
                      r.economics.payback?.payback_display
                        ? formatPayback(r.economics.payback)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-steel-500">Нет данных сравнения</p>
        )}
      </Card>

      <Card title="Допущения и ограничения">
        <ul className="list-disc space-y-1 pl-5 text-sm text-steel-700">
          <li>Финансовые показатели — предварительная оценка, не коммерческое предложение.</li>
          <li>Доля снижения затрат на труд задаётся пользователем, это не отраслевая статистика.</li>
          <li>Симуляция — дискретно-событийная демонстрация, не цифровой двойник.</li>
          <li>Отсутствующие ТТХ в каталоге не подменяются выдуманными значениями.</li>
          {econ?.assumption_flags?.unit_price_assumed ? (
            <li>
              Цена робота отсутствует в каталоге — в расчёте использовано демо-допущение
              стоимости (не коммерческое предложение).
            </li>
          ) : null}
          {econ?.assumption_flags
            ? Object.keys(econ.assumption_flags)
                .filter((k) => k !== 'unit_price_assumed')
                .map((k) => <li key={k}>Допущение модели: {k}</li>)
            : null}
        </ul>
      </Card>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-steel-500">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-steel-100 bg-steel-50/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-steel-400">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function MiniPlan({ layout }: { layout: { width: number; height: number; zones: { x: number; y: number; w: number; h: number; color?: string }[]; routes: { points: { x: number; y: number }[] }[] } }) {
  const scale = Math.min(640 / layout.width, 320 / layout.height)
  const w = layout.width * scale
  const h = layout.height * scale
  return (
    <svg width={w} height={h} viewBox={`0 0 ${layout.width} ${layout.height}`} className="max-w-full bg-white">
      <rect x={0} y={0} width={layout.width} height={layout.height} fill="#f8fafc" stroke="#cbd5e1" />
      {layout.zones.map((z, i) => (
        <rect
          key={i}
          x={z.x}
          y={z.y}
          width={z.w}
          height={z.h}
          fill={z.color || '#cbd5e1'}
          opacity={0.85}
          stroke="#64748b"
        />
      ))}
      {layout.routes.map((r, i) => (
        <polyline
          key={i}
          fill="none"
          stroke="#ea580c"
          strokeWidth={2 / scale}
          strokeDasharray={`${6 / scale} ${4 / scale}`}
          points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
        />
      ))}
    </svg>
  )
}
