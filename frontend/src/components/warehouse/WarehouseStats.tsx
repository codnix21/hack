import type { SimulationSnapshot, LayerFlags } from '../../simulation/types'
import { TASK_STATUS_RU } from '../../simulation/types'
import { displayRouteLengthM, metricsFromSnapshot } from '../../simulation/simMetrics'
import { formatNumber } from '../../utils/format'

interface StatsProps {
  snapshot: SimulationSnapshot
}

export function WarehouseStats({ snapshot }: StatsProps) {
  const m = metricsFromSnapshot(snapshot)
  const fleet = Math.max(1, m.visibleRobots || m.configuredRobots || 1)
  const taskTotal = Math.max(
    1,
    m.completedTasks + m.activeTasks + m.blockedTasks + m.queuedTasks,
  )
  return (
    <div className="space-y-2" data-testid="sim-kpi-panel">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Stat
          title="В конфигурации"
          value={String(m.configuredRobots)}
          sub={
            m.robotsCapped
              ? `на схеме анимируется ${m.visibleRobots} из ${m.configuredRobots}`
              : `на схеме: ${m.visibleRobots}`
          }
          fill={(m.visibleRobots / Math.max(1, m.configuredRobots)) * 100}
          accent="var(--nc-accent)"
        />
        <Stat
          title="Движутся / ждут"
          value={`${m.movingRobots} / ${m.waitingRobots}`}
          sub={`заблок. ${m.blockedRobots} · свободны ${m.idleRobots}`}
          fill={(m.movingRobots / fleet) * 100}
          accent="var(--nc-cyan)"
        />
        <Stat
          title="Пройденный путь"
          value={`${formatNumber(m.acceptedDistanceMeters, 1)} м`}
          sub="сумма принятых шагов на схеме"
          fill={Math.min(100, m.acceptedDistanceMeters / 5)}
          accent="var(--nc-lime)"
        />
        <Stat
          title="Задания"
          value={`${m.completedTasks} гот.`}
          sub={`активны ${m.activeTasks} · блок. ${m.blockedTasks} · в очереди ${m.queuedTasks}`}
          fill={(m.completedTasks / taskTotal) * 100}
          accent="var(--nc-info)"
        />
        <Stat
          title="Свободны (IDLE)"
          value={String(m.idleRobots)}
          sub="без исполняемого движения"
          fill={(m.idleRobots / fleet) * 100}
          accent="var(--nc-muted)"
        />
        <Stat
          title="Без назначения"
          value={String(m.unassignedTasks)}
          sub="queued без робота"
          fill={Math.min(100, m.unassignedTasks * 25)}
          accent="var(--nc-warning)"
        />
      </div>
      <div className="rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-3 py-2">
        <p className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--nc-text)]">
          Состав флота на схеме
        </p>
        <div className="flex h-2.5 overflow-hidden rounded-sm bg-[var(--nc-surface-hover)]" aria-hidden>
          <Seg pct={(m.movingRobots / fleet) * 100} color="var(--nc-accent)" />
          <Seg pct={(m.waitingRobots / fleet) * 100} color="var(--nc-warning)" />
          <Seg pct={(m.idleRobots / fleet) * 100} color="var(--nc-cyan)" />
          <Seg pct={(m.blockedRobots / fleet) * 100} color="var(--nc-danger)" />
        </div>
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--nc-text)]">
          <li>
            <span className="text-[var(--nc-accent)]">●</span> движутся {m.movingRobots}
          </li>
          <li>
            <span className="text-[var(--nc-warning)]">●</span> ждут {m.waitingRobots}
          </li>
          <li>
            <span className="text-[var(--nc-cyan)]">●</span> idle {m.idleRobots}
          </li>
          <li>
            <span className="text-[var(--nc-danger)]">●</span> блок {m.blockedRobots}
          </li>
        </ul>
      </div>
    </div>
  )
}

function Seg({ pct, color }: { pct: number; color: string }) {
  if (pct <= 0) return null
  return <div className="h-full" style={{ width: `${pct}%`, background: color }} />
}

function Stat({
  title,
  value,
  sub,
  fill,
  accent,
}: {
  title: string
  value: string
  sub?: string
  fill?: number
  accent?: string
}) {
  const pct = Math.max(0, Math.min(100, fill ?? 0))
  return (
    <div className="rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-3 py-2.5">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--nc-text)]">
        {title}
      </p>
      <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-[var(--nc-ink)]">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--nc-muted)]">{sub}</p> : null}
      {accent ? (
        <div className="mt-2 h-1 overflow-hidden rounded-sm bg-[var(--nc-surface-hover)]" aria-hidden>
          <div className="h-full rounded-sm" style={{ width: `${Math.max(4, pct)}%`, background: accent }} />
        </div>
      ) : null}
    </div>
  )
}

interface LayersProps {
  layers: LayerFlags
  onToggle: (key: keyof LayerFlags) => void
}

const LAYER_ITEMS: { key: keyof LayerFlags; label: string; defaultOn?: boolean }[] = [
  { key: 'robots', label: 'Роботы' },
  { key: 'shelves', label: 'Стеллажи' },
  { key: 'routes', label: 'Маршруты' },
  { key: 'zones', label: 'Зоны' },
  { key: 'tasks', label: 'Задания' },
  { key: 'heatmap', label: 'Тепловая карта' },
  { key: 'directions', label: 'Направление' },
  { key: 'collisions', label: 'Коллизии' },
]

export function WarehouseLayers({ layers, onToggle }: LayersProps) {
  return (
    <div>
      <ul className="grid grid-cols-2 gap-1">
        {LAYER_ITEMS.map((item) => {
          const on = layers[item.key]
          return (
            <li key={item.key}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition focus-within:ring-2 focus-within:ring-brand-500 ${
                  on ? 'bg-[var(--nc-surface-hover)] text-[var(--nc-ink)]' : 'text-[var(--nc-text)] hover:bg-[var(--nc-surface-hover)] hover:text-[var(--nc-ink)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(item.key)}
                  className="h-3.5 w-3.5 rounded border-[var(--nc-border)] text-[var(--nc-accent)] focus:ring-brand-500"
                />
                <span className="truncate">{item.label}</span>
              </label>
            </li>
          )
        })}
      </ul>
      {layers.heatmap ? (
        <p className="mt-2 text-[11px] text-[var(--nc-muted)]">Тепловая карта — иллюстративные данные</p>
      ) : null}
    </div>
  )
}

export function WarehouseEvents({ snapshot }: StatsProps) {
  return (
    <div className="nc-panel p-3">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <p className="nc-section-label">События</p>
        {snapshot.events.length > 0 ? (
          <span className="font-mono text-[10px] text-[var(--nc-muted)]">{snapshot.events.length}</span>
        ) : null}
      </div>
      {snapshot.events.length === 0 ? (
        <p className="py-3 text-center text-sm text-[var(--nc-muted)]">Запустите симуляцию</p>
      ) : (
        <ul className="max-h-52 space-y-0 overflow-auto">
          {snapshot.events.map((e) => (
            <li
              key={e.id}
              className="flex gap-2 border-b border-[var(--nc-border-subtle)] py-2 text-sm last:border-0"
            >
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--nc-muted)]">
                {e.clock}
              </span>
              <span className="min-w-0 leading-snug text-[var(--nc-text)]">{e.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function WarehouseTasks({
  snapshot,
  selectedTaskId,
  onSelectTask,
}: StatsProps & {
  selectedTaskId?: string | null
  onSelectTask?: (id: string) => void
}) {
  if (!snapshot.tasks.length) return null
  return (
    <div className="nc-panel p-3" data-testid="sim-tasks-panel">
      <p className="nc-section-label mb-2.5">Задания</p>
      <ul className="max-h-56 space-y-0 overflow-auto">
        {snapshot.tasks.slice(0, 12).map((t) => {
          const active = selectedTaskId === t.id
          const len = displayRouteLengthM(t)
          return (
            <li key={t.id}>
              <button
                type="button"
                className={`nc-focusable flex w-full flex-col gap-0.5 border-b border-[var(--nc-border-subtle)] px-1.5 py-2 text-left text-sm last:border-0 ${
                  active ? 'bg-[var(--nc-surface-selected)] ring-1 ring-inset ring-[var(--nc-accent-line)]' : 'hover:bg-[var(--nc-surface-hover)]'
                }`}
                onClick={() => onSelectTask?.(t.id)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium tabular-nums text-[var(--nc-ink)]">{t.id}</span>
                  <span className="truncate text-xs text-[var(--nc-muted)]">{TASK_STATUS_RU[t.status]}</span>
                </span>
                <span className="truncate text-[11px] text-[var(--nc-muted)]">
                  {t.source} → {t.destination}
                  {len != null ? ` · ${len.toFixed(1)} м` : ''}
                  {t.blocked || t.status === 'BLOCKED' ? ' · нет пути' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
