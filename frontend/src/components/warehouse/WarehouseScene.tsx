import { lazy, Suspense, useMemo, useState } from 'react'
import { Pause, Play, RotateCcw, Camera, ChevronDown } from 'lucide-react'
import type { CalculationSummary, VisualizationLayout } from '../../types'
import { useWarehouseSimulation } from '../../simulation/useWarehouseSimulation'
import type { ViewMode } from '../../simulation/types'
import { PHASE_LABEL_RU } from '../../simulation/simMetrics'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Disclosure } from '../ui/Disclosure'
import { Callout } from '../ui/Callout'
import { StatusPill } from '../ui/StatusPill'
import { Warehouse2D } from './Warehouse2D'
import { WarehouseIsometric } from './WarehouseIsometric'
import { RobotDetails } from './RobotDetails'
import {
  WarehouseEvents,
  WarehouseLayers,
  WarehouseTasks,
} from './WarehouseStats'
import { formatNumber } from '../../utils/format'

const Warehouse3D = lazy(() =>
  import('./Warehouse3D').then((m) => ({ default: m.Warehouse3D })),
)

interface WarehouseSceneProps {
  layout: VisualizationLayout
  calculation: CalculationSummary
  scenarios?: { id: string; label: string }[]
  scenarioId?: string
  onScenarioChange?: (id: string) => void
  robotsCount?: number
  onRobotsCountChange?: (n: number) => void
}

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: '2d', label: '2D' },
  { id: 'isometric', label: 'Изометрия' },
  { id: '3d', label: '3D' },
]

const SPEEDS = [
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
  { value: 8, label: '8×' },
]

export function WarehouseScene({
  layout,
  calculation,
  scenarios = [],
  scenarioId,
  onScenarioChange,
  robotsCount,
  onRobotsCountChange,
}: WarehouseSceneProps) {
  const [view, setView] = useState<ViewMode>('2d')
  const [cameraPreset, setCameraPreset] = useState<'top' | 'iso' | 'side' | 'reset'>('iso')
  const [bottomOpen, setBottomOpen] = useState(false)
  const sim = useWarehouseSimulation({ layout, calculation, scenarioId })
  const activeRobots = robotsCount ?? calculation.robot_count
  const metrics = sim.snapshot.metrics
  const phase = metrics?.phase || 'ready'
  const playLabel = PHASE_LABEL_RU[phase] || 'Ожидание'

  const heatSamples = useMemo(() => {
    if (!sim.layers.heatmap) return []
    return sim.snapshot.robots.map((r) => ({ x: r.x, y: r.y }))
  }, [sim.layers.heatmap, sim.snapshot.robots])

  const phaseTone =
    phase === 'running'
      ? 'success'
      : phase === 'paused'
        ? 'warning'
        : phase === 'stalled'
          ? 'danger'
          : phase === 'completed'
            ? 'neutral'
            : 'idle'

  return (
    <div className="space-y-2" data-testid="warehouse-scene">
      <Callout variant="warning" title="Симуляция сценария (DES)">
        Не цифровой двойник и не телеметрия склада. Play/Pause/Reset управляют анимацией на плане;
        «завершено» относится к заданиям модели, а не к внедрению на объекте.
      </Callout>

      <div
        className="nc-panel px-2.5 py-2"
        data-testid="sim-kpi-panel"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span data-testid="sim-play-state" data-phase={phase}>
              <StatusPill tone={phaseTone}>{playLabel}</StatusPill>
            </span>
            <span
              className="font-mono text-[11px] text-[var(--nc-muted)]"
              data-testid="sim-config-label"
            >
              задания акт/блок/гот {metrics?.activeTasks ?? 0}/{metrics?.blockedTasks ?? 0}/
              {metrics?.completedTasks ?? 0}
              {sim.snapshot.robotsCapped
                ? ` · на схеме ${sim.snapshot.visibleRobots} из ${sim.snapshot.totalRobots}`
                : ` · на схеме ${sim.snapshot.visibleRobots}`}
              {` · ${formatNumber(metrics?.acceptedDistanceMeters ?? 0, 1)} м`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Режим отображения"
              items={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
              value={view}
              onChange={(id) => setView(id as ViewMode)}
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={sim.start}
                disabled={sim.play === 'running' || sim.snapshot.visibleRobots === 0}
                aria-label="Запустить симуляцию"
              >
                <Play className="h-3.5 w-3.5" />
                Запустить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={sim.pause}
                disabled={sim.play !== 'running'}
                aria-label="Пауза"
              >
                <Pause className="h-3.5 w-3.5" />
                Пауза
              </Button>
              <Button size="sm" variant="outline" onClick={sim.reset} aria-label="Сбросить симуляцию">
                <RotateCcw className="h-3.5 w-3.5" />
                Сбросить
              </Button>
            </div>
            <Segmented
              ariaLabel="Скорость симуляции"
              items={SPEEDS.map((s) => ({ id: String(s.value), label: s.label }))}
              value={String(sim.speed)}
              onChange={(id) => sim.setSpeed(Number(id))}
            />
            {scenarios.length > 0 && (
              <Select
                className="h-8 w-44 !py-0"
                value={scenarioId || scenarios[0]?.id}
                onChange={(e) => onScenarioChange?.(e.target.value)}
                options={scenarios.map((s) => ({ value: s.id, label: s.label }))}
                aria-label="Сценарий"
              />
            )}
            {onRobotsCountChange && (
              <label className="flex items-center gap-1.5 text-xs text-[var(--nc-muted)]">
                <span className="whitespace-nowrap">В модели</span>
                <input
                  data-testid="sim-robots-count"
                  type="number"
                  min={0}
                  max={200}
                  className="h-8 w-16 rounded border border-[var(--nc-border-strong)] px-1.5 text-sm"
                  value={activeRobots}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(200, Number(e.target.value) || 0))
                    onRobotsCountChange(n)
                  }}
                  aria-label="Количество роботов в симуляции"
                />
              </label>
            )}
          </div>
        </div>

        {(sim.layoutStale ||
          (layout.raw?.meta?.route_warnings as string[] | undefined)?.length) && (
          <p className="mt-2 text-xs text-[var(--nc-warning)]" data-testid="sim-route-warnings">
            {sim.layoutStale
              ? 'План изменился — сцена пересобрана. '
              : ''}
            {((layout.raw?.meta?.route_warnings as string[]) || []).slice(0, 2).join(' ')}
          </p>
        )}
        {(activeRobots !== sim.snapshot.visibleRobots || sim.snapshot.robotsCapped) && (
          <p
            className="mt-2 rounded border border-[rgba(245,193,74,0.55)] bg-[var(--nc-warning-soft)] px-2.5 py-2 text-xs leading-snug text-[var(--nc-ink)]"
            data-testid="sim-robots-mismatch"
            role="status"
          >
            <span className="font-semibold text-[var(--nc-warning)]">В модели: {activeRobots}</span>
            {' · '}
            <span className="font-semibold text-[var(--nc-ink)]">
              на схеме: {sim.snapshot.visibleRobots}
              {sim.snapshot.totalRobots != null && sim.snapshot.totalRobots !== sim.snapshot.visibleRobots
                ? ` из ${sim.snapshot.totalRobots}`
                : ''}
            </span>
            <span className="text-[var(--nc-text)]">
              . Разница — ограничение анимации DES или ручная настройка «В модели»; на экономику не
              влияет.
            </span>
          </p>
        )}
      </div>

      {/* Сцена + инспектор */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="nc-panel min-w-0 overflow-hidden">
          <div className="nc-canvas-surface p-1.5 sm:p-2">
            {view === '2d' && (
              <Warehouse2D
                layout={layout}
                robots={sim.snapshot.robots}
                collisions={sim.snapshot.collisions}
                layers={sim.layers}
                selectedRobotId={sim.selectedRobotId}
                selectedRouteId={sim.selectedTask?.routeId || null}
                onSelectRobot={(id) => {
                  sim.setSelectedRobotId(id)
                  const r = sim.snapshot.robots.find((x) => x.id === id)
                  if (r?.taskId) sim.setSelectedTaskId(r.taskId)
                }}
                heatSamples={heatSamples}
              />
            )}
            {view === 'isometric' && (
              <WarehouseIsometric
                layout={layout}
                robots={sim.snapshot.robots}
                collisions={sim.snapshot.collisions}
                layers={sim.layers}
                selectedRobotId={sim.selectedRobotId}
                onSelectRobot={sim.setSelectedRobotId}
              />
            )}
            {view === '3d' && (
              <Suspense
                fallback={
                  <div className="flex h-[420px] items-center justify-center text-sm text-[var(--nc-muted)]">
                    Загрузка 3D…
                  </div>
                }
              >
                <Warehouse3D
                  layout={layout}
                  robots={sim.snapshot.robots}
                  collisions={sim.snapshot.collisions}
                  layers={sim.layers}
                  selectedRobotId={sim.selectedRobotId}
                  onSelectRobot={sim.setSelectedRobotId}
                  followRobot={sim.followRobot}
                  cameraPreset={cameraPreset}
                  onCameraApplied={() => setCameraPreset('reset')}
                />
              </Suspense>
            )}
          </div>
          {view === '3d' && (
            <div className="flex flex-wrap gap-1 border-t border-[var(--nc-border-subtle)] px-3 py-2">
              {(
                [
                  ['top', 'Сверху'],
                  ['iso', 'Изометрия'],
                  ['side', 'Сбоку'],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setCameraPreset(id)}
                >
                  {label}
                </Button>
              ))}
              <Button size="sm" variant="outline" className="h-8" onClick={() => setCameraPreset('iso')}>
                <Camera className="h-3.5 w-3.5" />
                Камера
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-2 xl:sticky xl:top-3 xl:self-start">
          <details className="nc-panel xl:hidden">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[var(--nc-ink)]">
              Инспектор робота
            </summary>
            <div className="border-t border-[var(--nc-border-subtle)]">
              <RobotDetails
                robot={sim.selectedRobot}
                task={sim.selectedTask}
                followRobot={sim.followRobot}
                onFollowChange={sim.setFollowRobot}
                robots={sim.snapshot.robots}
                selectedRobotId={sim.selectedRobotId}
                onSelectRobot={sim.setSelectedRobotId}
              />
            </div>
          </details>
          <div className="hidden xl:block">
            <RobotDetails
              robot={sim.selectedRobot}
              task={sim.selectedTask}
              followRobot={sim.followRobot}
              onFollowChange={sim.setFollowRobot}
              robots={sim.snapshot.robots}
              selectedRobotId={sim.selectedRobotId}
              onSelectRobot={sim.setSelectedRobotId}
            />
          </div>
          <Disclosure title="Слои отображения">
            <WarehouseLayers layers={sim.layers} onToggle={sim.toggleLayer} />
          </Disclosure>
        </aside>
      </div>

      <div className="nc-panel">
        <button
          type="button"
          className="nc-focusable flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--nc-ink)]"
          onClick={() => setBottomOpen((v) => !v)}
          aria-expanded={bottomOpen}
        >
          <span>
            Задания и события
            {(metrics?.blockedTasks ?? 0) > 0
              ? ` · ${metrics?.blockedTasks} заблокировано`
              : ''}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[var(--nc-faint)] transition ${bottomOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {bottomOpen ? (
          <div className="grid gap-3 border-t border-[var(--nc-border-subtle)] p-3 lg:grid-cols-2">
            <WarehouseTasks
              snapshot={sim.snapshot}
              selectedTaskId={sim.selectedTaskId}
              onSelectTask={(id) => {
                sim.setSelectedTaskId(id)
                const t = sim.snapshot.tasks.find((x) => x.id === id)
                if (t?.robotId) sim.setSelectedRobotId(t.robotId)
              }}
            />
            <WarehouseEvents snapshot={sim.snapshot} />
          </div>
        ) : null}
      </div>

      <Disclosure title="Ограничения модели">
        <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--nc-muted)]" data-testid="sim-pathfinding-note">
          <li>DES не является цифровым двойником склада.</li>
          <li>
            На схеме анимируется не более 6 роботов; в конфигурации может быть больше (
            {activeRobots}).
          </li>
          <li>Разведение конфликтов упрощённое (приоритет по id, ожидание с таймаутом).</li>
          <li>Батарея и clearance — параметры модели, не физическая валидация проходимости.</li>
          {typeof layout.raw?.meta?.pathfinding_note === 'string' ? (
            <li>{layout.raw.meta.pathfinding_note as string}</li>
          ) : null}
        </ul>
      </Disclosure>
    </div>
  )
}

function Segmented({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  ariaLabel: string
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded border border-[var(--nc-border-strong)] bg-[var(--nc-surface-muted)] p-0.5"
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            className={`min-w-[2.5rem] rounded px-2 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              active
                ? 'bg-ink text-white shadow-sm'
                : 'text-[var(--nc-muted)] hover:bg-[var(--nc-surface)] hover:text-[var(--nc-ink)]'
            }`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
