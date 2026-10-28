import { useId, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, FileSpreadsheet, FileText, Link2, Play, Share2 } from 'lucide-react'
import { economicsApi, matchingApi, visualizationApi } from '../../api/economics'
import { projectsApi } from '../../api/projects'
import { getFriendlyError } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { formatCurrency, formatNumber, formatPayback, formatPercent } from '../../utils/format'
import { matchStatusLabel, metricLabel, workModeLabel } from '../../utils/labels'
import { toastError, toastSuccess } from '../../store/toastStore'
import { zoneFill, zoneStroke } from '../warehouse/drawHelpers'
import type { Project, VisualizationLayout } from '../../types'

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
  /** Только решение с «В расчёт» (selected), не все «предварительно подходит». */
  const selected = useMemo(
    () => (matchQuery.data?.results || []).filter((r) => r.selected),
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
      <div className="nc-command-frame relative overflow-hidden px-6 py-7 sm:px-7 sm:py-8">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--nc-accent)]">
          Итог для руководства
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-snug break-words text-[var(--nc-ink)] sm:text-3xl">
          {project.name}
        </h2>
        <p className="nc-body mt-2 max-w-2xl">
          {project.description || 'Предварительная оценка роботизации склада'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {area != null && (
            <span className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface-muted)] px-2.5 py-1 font-mono text-[11px] text-[var(--nc-text)]">
              Площадь ≈ {formatNumber(area, 0)} м²
            </span>
          )}
          {project.work_mode && (
            <span className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface-muted)] px-2.5 py-1 font-mono text-[11px] text-[var(--nc-text)]">
              Режим {workModeLabel(project.work_mode)}
            </span>
          )}
          {project.region && (
            <span className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface-muted)] px-2.5 py-1 font-mono text-[11px] text-[var(--nc-text)]">
              {project.region}
            </span>
          )}
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
                  className="inline-flex h-10 items-center gap-2 rounded border border-[var(--nc-border)] px-3 text-sm text-[var(--nc-text)] hover:bg-[var(--nc-surface-hover)]"
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
        <p className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          <Link2 className="h-4 w-4" />
          Публичная ссылка (только чтение): {shareUrl}
        </p>
      )}

      {econ && (
        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          data-testid="report-kpi-strip"
        >
          <HeroKpi label={metricLabel('capex')} value={formatCurrency(econ.capex?.capex)} />
          <HeroKpi
            label={metricLabel('annual_effect')}
            value={formatCurrency(
              econ.annual_effect?.net_annual_effect ?? econ.annual_effect?.annual_effect,
            )}
          />
          <HeroKpi label={metricLabel('payback')} value={formatPayback(econ.payback)} />
          <HeroKpi
            label={metricLabel('roi')}
            value={
              econ.roi?.roi_percent != null
                ? formatPercent(Number(econ.roi.roi_percent))
                : 'Нет данных'
            }
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Параметры склада">
          <div className="grid gap-2 sm:grid-cols-2">
            <ParamTile label="Площадь" value={area != null ? `${formatNumber(area, 0)} м²` : 'Не задана'} />
            <ParamTile
              label="Ширина"
              value={params.area_width_m != null ? `${params.area_width_m} м` : '—'}
            />
            <ParamTile
              label="Длина"
              value={params.area_length_m != null ? `${params.area_length_m} м` : '—'}
            />
            <ParamTile
              label="Пиковая нагрузка"
              value={params.peak_demand != null ? `${params.peak_demand} оп/ч` : '—'}
            />
            <ParamTile
              label="Проходы"
              value={params.aisle_width_mm != null ? `${params.aisle_width_mm} мм` : '—'}
            />
          </div>
        </Card>

        <Card title="Ключевые показатели для решения">
          {econQuery.isLoading && <p className="text-sm text-[var(--nc-muted)]">Расчёт…</p>}
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
          <MiniPlan layout={layoutQuery.data} />
        ) : (
          <p className="text-sm text-[var(--nc-muted)]">План загружается…</p>
        )}
      </Card>

      <Card title="Выбранные решения" subtitle="База для экономики — кнопка «В расчёт» на этапе подбора">
        {selected.length === 0 ? (
          <p className="text-sm text-[var(--nc-muted)]">
            На этапе «Подбор» нажмите «В расчёт» у одной модели.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {selected.map((r) => (
              <li
                key={r.robot_id}
                className="rounded border border-[var(--nc-border-subtle)] border-l-[3px] border-l-[var(--nc-accent)] bg-[var(--nc-surface-muted)] px-3 py-2.5"
              >
                <p className="font-medium text-[var(--nc-ink)]">
                  {r.robot_name || `#${r.robot_id}`}
                </p>
                <p className="mt-0.5 text-sm text-[var(--nc-text)]">
                  {r.recommended_count != null
                    ? `${r.recommended_count} ед.`
                    : matchStatusLabel(r.status)}
                  {r.robot_price_rub != null ? ` · ${formatCurrency(r.robot_price_rub)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Сравнение альтернатив парка" subtitle="Оценочные конфигурации">
        {fleetQuery.data?.rows ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fleetQuery.data.rows.map((r) => (
              <div
                key={r.code}
                className="rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-3 py-3"
              >
                <p className="font-medium text-[var(--nc-ink)]">{r.name_ru}</p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--nc-muted)]">Капитальные затраты</dt>
                    <dd className="font-medium tabular-nums text-[var(--nc-text)]">
                      {formatCurrency(r.economics.capex?.capex)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--nc-muted)]">Годовой эффект</dt>
                    <dd className="font-medium tabular-nums text-[var(--nc-text)]">
                      {formatCurrency(r.economics.annual_effect?.annual_effect)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--nc-muted)]">Окупаемость</dt>
                    <dd className="font-medium tabular-nums text-[var(--nc-text)]">
                      {formatPayback(r.economics.payback)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--nc-muted)]">Нет данных сравнения</p>
        )}
      </Card>

      <Card title="Допущения и ограничения">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--nc-text)]">
          <li>Финансовые показатели — предварительная оценка, не коммерческое предложение.</li>
          <li>Доля снижения затрат на труд задаётся пользователем, это не отраслевая статистика.</li>
          <li>Симуляция — дискретно-событийная модель, не цифровой двойник.</li>
          <li>Отсутствующие ТТХ в каталоге не подменяются выдуманными значениями.</li>
          {econ?.assumption_flags?.unit_price_assumed ? (
            <li>
              Цена робота отсутствует в каталоге — в расчёте использовано допущение
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

function HeroKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative overflow-hidden rounded border border-[var(--nc-border)] bg-[var(--nc-surface)] px-3 py-3">
      <span
        className="absolute inset-y-0 left-0 w-1 bg-[var(--nc-accent)]"
        aria-hidden
      />
      <p className="pl-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--nc-muted)]">
        {label}
      </p>
      <p className="mt-1 pl-2 font-display text-xl font-semibold tabular-nums text-[var(--nc-ink)]">
        {value}
      </p>
    </div>
  )
}

function ParamTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--nc-muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-[var(--nc-ink)]">{value}</p>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--nc-text)]">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-[var(--nc-ink)]">
        {value}
      </p>
    </div>
  )
}

function MiniPlan({ layout }: { layout: VisualizationLayout }) {
  const theme = useThemeStore((s) => s.theme)
  const gridId = useId().replace(/:/g, '')
  // Толщина линий в координатах плана — доля от размера, чтобы не плыла при любом масштабе
  const unit = Math.max(layout.width, layout.height) / 400
  const gridStep = Math.max(24, Math.round(Math.min(layout.width, layout.height) / 16))

  return (
    <div
      key={theme}
      className="overflow-hidden rounded border border-[var(--nc-border)] bg-[var(--nc-canvas)]"
    >
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto max-h-[min(56vh,440px)] w-full"
        role="img"
        aria-label="План склада"
      >
        <defs>
          <pattern
            id={gridId}
            width={gridStep}
            height={gridStep}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
              fill="none"
              stroke="var(--nc-canvas-grid)"
              strokeWidth={1}
            />
          </pattern>
        </defs>
        <rect width={layout.width} height={layout.height} fill="var(--nc-canvas)" />
        <rect width={layout.width} height={layout.height} fill={`url(#${gridId})`} />
        <rect
          x={unit}
          y={unit}
          width={layout.width - unit * 2}
          height={layout.height - unit * 2}
          fill="none"
          stroke="var(--nc-accent-line)"
          strokeWidth={unit * 1.2}
        />
        {layout.zones.map((z, i) => (
          <rect
            key={z.id || i}
            x={z.x}
            y={z.y}
            width={z.w}
            height={z.h}
            fill={zoneFill(z.type, z.color)}
            stroke={zoneStroke(z.type)}
            strokeWidth={unit * 0.9}
            rx={unit * 0.6}
          />
        ))}
        {layout.routes.map((r, i) => (
          <polyline
            key={r.id || i}
            fill="none"
            stroke="var(--nc-route)"
            strokeWidth={unit * 2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${unit * 7} ${unit * 4}`}
            points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
          />
        ))}
      </svg>
    </div>
  )
}
