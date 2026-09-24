import { lazy, Suspense, useMemo, useState } from 'react'
import { Pause, Play, RotateCcw, Camera } from 'lucide-react'
import type { CalculationSummary, VisualizationLayout } from '../../types'
import { useWarehouseSimulation } from '../../simulation/useWarehouseSimulation'
import type { ViewMode } from '../../simulation/types'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Warehouse2D } from './Warehouse2D'
import { WarehouseIsometric } from './WarehouseIsometric'
import { RobotDetails } from './RobotDetails'
import {
  WarehouseEvents,
  WarehouseLayers,
  WarehouseStats,
  WarehouseTasks,
} from './WarehouseStats'

const Warehouse3D = lazy(() =>
  import('./Warehouse3D').then((m) => ({ default: m.Warehouse3D })),
)

interface WarehouseSceneProps {
  layout: VisualizationLayout
  calculation: CalculationSummary
  scenarios?: { id: string; label: string }[]
  scenarioId?: string
  onScenarioChange?: (id: string) => void
}

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: '2d', label: '2D' },
  { id: 'isometric', label: 'Изометрия' },
  { id: '3d', label: '3D' },
]

const SPEEDS = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
]

export function WarehouseScene({
  layout,
  calculation,
  scenarios = [],
  scenarioId,
  onScenarioChange,
}: WarehouseSceneProps) {
  const [view, setView] = useState<ViewMode>('2d')
  const [cameraPreset, setCameraPreset] = useState<'top' | 'iso' | 'side' | 'reset'>('iso')
  const sim = useWarehouseSimulation({ layout, calculation, scenarioId })

  const heatSamples = useMemo(() => {
    if (!sim.layers.heatmap) return []
    return sim.snapshot.robots.map((r) => ({ x: r.x, y: r.y }))
  }, [sim.layers.heatmap, sim.snapshot.robots])

  return (
    <div className="space-y-5">
      {/* Notice — one line, not a second title block */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-brand-500 bg-steel-50 px-3 py-2 text-sm text-steel-600">
        <p>
          Демонстрационная симуляция. Данные не являются телеметрией реального объекта.
        </p>
        {sim.snapshot.robotsCapped ? (
          <p className="font-mono text-xs text-steel-500">
            на схеме {sim.snapshot.visibleRobots} из {sim.snapshot.totalRobots}
          </p>
        ) : null}
      </div>

      {/* Control surface */}
      <div className="rounded border border-steel-200 bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-steel-100 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              ariaLabel="Режим отображения"
              items={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
              value={view}
              onChange={(id) => setView(id as ViewMode)}
            />

            <div className="hidden h-6 w-px bg-steel-200 sm:block" aria-hidden />

            <div className="flex flex-wrap items-center gap-1.5">
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

            <div className="hidden h-6 w-px bg-steel-200 sm:block" aria-hidden />

            <Segmented
              ariaLabel="Скорость симуляции"
              items={SPEEDS.map((s) => ({ id: String(s.value), label: s.label }))}
              value={String(sim.speed)}
              onChange={(id) => sim.setSpeed(Number(id))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {scenarios.length > 0 && (
              <Select
                className="h-8 w-52 !py-0"
                value={scenarioId || scenarios[0]?.id}
                onChange={(e) => onScenarioChange?.(e.target.value)}
                options={scenarios.map((s) => ({ value: s.id, label: s.label }))}
                aria-label="Сценарий"
              />
            )}
            {view === '3d' && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Ракурсы камеры">
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
                    aria-label={`Ракурс: ${label}`}
                  >
                    {label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setCameraPreset('iso')}
                  aria-label="Сбросить камеру"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Камера
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="px-3 py-3">
          <WarehouseStats snapshot={sim.snapshot} />
        </div>
      </div>

      {/* Main stage + inspector */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded border border-steel-200 bg-white shadow-panel">
            <div className="flex items-center justify-between gap-2 border-b border-steel-100 bg-steel-50/80 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-steel-400">
                  Сцена склада
                </span>
                <span className="rounded-sm bg-white px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-steel-500 ring-1 ring-steel-200">
                  {view === '2d' ? 'План 2D' : view === 'isometric' ? 'Изометрия' : 'Объём 3D'}
                </span>
              </div>
              <PlayBadge play={sim.play} />
            </div>

            <div className="bg-[#eef0f3] p-3 sm:p-4">
              {view === '2d' && (
                <Warehouse2D
                  layout={layout}
                  robots={sim.snapshot.robots}
                  collisions={sim.snapshot.collisions}
                  layers={sim.layers}
                  selectedRobotId={sim.selectedRobotId}
                  onSelectRobot={sim.setSelectedRobotId}
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
                    <div className="flex h-[360px] items-center justify-center text-sm text-steel-500">
                      Загрузка 3D-модуля…
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

            <div className="border-t border-steel-100 px-3 py-2.5">
              <LegendStrip />
            </div>
          </div>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <RobotDetails
            robot={sim.selectedRobot}
            task={sim.selectedTask}
            followRobot={sim.followRobot}
            onFollowChange={sim.setFollowRobot}
            robots={sim.snapshot.robots}
            selectedRobotId={sim.selectedRobotId}
            onSelectRobot={sim.setSelectedRobotId}
          />
          <WarehouseLayers layers={sim.layers} onToggle={sim.toggleLayer} />
          {sim.layers.tasks && <WarehouseTasks snapshot={sim.snapshot} />}
          <WarehouseEvents snapshot={sim.snapshot} />
        </aside>
      </div>
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
      className="inline-flex overflow-hidden rounded border border-steel-300 bg-steel-50 p-0.5"
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
            className={`min-w-[3rem] rounded px-2.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
              active
                ? 'bg-ink text-white shadow-sm'
                : 'text-steel-600 hover:bg-white hover:text-steel-900'
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

function PlayBadge({ play }: { play: string }) {
  const label =
    play === 'running' ? 'Идёт симуляция' : play === 'paused' ? 'Пауза' : 'Ожидание'
  const color =
    play === 'running' ? 'bg-emerald-500' : play === 'paused' ? 'bg-amber-500' : 'bg-steel-400'
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-steel-500">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  )
}

function LegendStrip() {
  const items = [
    { color: '#14171c', label: 'AMR' },
    { color: '#f07316', label: 'Маршрут', line: true },
    { color: '#9aafc2', label: 'Стеллаж' },
    { color: '#c2410c', label: 'Загрузка' },
    { color: '#1d4ed8', label: 'Выгрузка' },
    { color: '#15803d', label: 'ЗС' },
  ]
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label="Легенда">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5 text-xs text-steel-600">
          {it.line ? (
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: it.color }} />
          ) : (
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: it.color }}
            />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  )
}
