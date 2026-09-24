import type { SimulationSnapshot, LayerFlags } from '../../simulation/types'
import { TASK_STATUS_RU } from '../../simulation/types'
import { formatNumber } from '../../utils/format'

interface StatsProps {
  snapshot: SimulationSnapshot
}

export function WarehouseStats({ snapshot }: StatsProps) {
  const { kpi, visibleRobots, totalRobots, robotsCapped } = snapshot
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        title="Роботы"
        value={robotsCapped ? `${visibleRobots} / ${totalRobots}` : String(visibleRobots)}
        sub={`активны ${kpi.activeRobots}`}
      />
      <Stat title="Пройденный путь" value={formatNumber(kpi.distance, 2)} sub="усл. ед. · demo" />
      <Stat title="Циклы" value={formatNumber(kpi.cycles)} sub="demo" />
      <Stat
        title="Задания"
        value={formatNumber(kpi.completedTasks)}
        sub={`активность ${kpi.activityPct}%`}
      />
    </div>
  )
}

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-steel-100 bg-steel-50/50 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel-400">{title}</p>
      <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-ink">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-steel-500">{sub}</p> : null}
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
    <div className="rounded border border-steel-200 bg-white p-3 shadow-panel">
      <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-steel-400">
        Слои отображения
      </p>
      <ul className="grid grid-cols-2 gap-1">
        {LAYER_ITEMS.map((item) => {
          const on = layers[item.key]
          return (
            <li key={item.key}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition focus-within:ring-2 focus-within:ring-brand-500 ${
                  on ? 'bg-steel-50 text-steel-900' : 'text-steel-500 hover:bg-steel-50/80'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(item.key)}
                  className="h-3.5 w-3.5 rounded border-steel-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="truncate">{item.label}</span>
              </label>
            </li>
          )
        })}
      </ul>
      {layers.heatmap ? (
        <p className="mt-2 border-t border-steel-100 pt-2 text-[11px] text-steel-400">
          Тепловая карта — демонстрационные данные
        </p>
      ) : null}
    </div>
  )
}

export function WarehouseEvents({ snapshot }: StatsProps) {
  return (
    <div className="rounded border border-steel-200 bg-white p-3 shadow-panel">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel-400">События</p>
        {snapshot.events.length > 0 ? (
          <span className="font-mono text-[10px] text-steel-400">{snapshot.events.length}</span>
        ) : null}
      </div>
      {snapshot.events.length === 0 ? (
        <p className="py-3 text-center text-sm text-steel-500">Запустите симуляцию</p>
      ) : (
        <ul className="max-h-52 space-y-0 overflow-auto">
          {snapshot.events.map((e) => (
            <li
              key={e.id}
              className="flex gap-2 border-b border-steel-50 py-2 text-sm last:border-0"
            >
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-steel-400">
                {e.clock}
              </span>
              <span className="min-w-0 leading-snug text-steel-700">{e.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function WarehouseTasks({ snapshot }: StatsProps) {
  if (!snapshot.tasks.length) return null
  return (
    <div className="rounded border border-steel-200 bg-white p-3 shadow-panel">
      <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-steel-400">
        Задания
      </p>
      <ul className="max-h-44 space-y-0 overflow-auto">
        {snapshot.tasks.slice(0, 8).map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-2 border-b border-steel-50 py-2 text-sm last:border-0"
          >
            <span className="font-medium tabular-nums text-steel-900">{t.id}</span>
            <span className="truncate text-xs text-steel-500">{TASK_STATUS_RU[t.status]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
