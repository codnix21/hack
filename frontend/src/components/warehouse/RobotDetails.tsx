import type { SimRobot, SimTask } from '../../simulation/types'
import { STATUS_COLOR, STATUS_LABEL_RU, TASK_STATUS_RU } from '../../simulation/types'
import { formatNumber } from '../../utils/format'

interface Props {
  robot: SimRobot | null
  task: SimTask | null
  followRobot: boolean
  onFollowChange: (v: boolean) => void
  robots?: SimRobot[]
  selectedRobotId?: string | null
  onSelectRobot?: (id: string | null) => void
}

export function RobotDetails({
  robot,
  task,
  followRobot,
  onFollowChange,
  robots = [],
  selectedRobotId,
  onSelectRobot,
}: Props) {
  return (
    <div className="overflow-hidden rounded border border-steel-200 bg-white shadow-panel">
      {robots.length > 0 && (
        <div className="flex gap-1 border-b border-steel-100 bg-steel-50/70 p-1.5">
          {robots.map((r) => {
            const active = selectedRobotId === r.id
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                aria-label={`Выбрать ${r.label}, ${STATUS_LABEL_RU[r.status]}`}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active
                    ? 'bg-ink text-white'
                    : 'text-steel-700 hover:bg-white'
                }`}
                onClick={() => onSelectRobot?.(r.id)}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: active ? '#f07316' : STATUS_COLOR[r.status] }}
                  aria-hidden
                />
                {r.label}
              </button>
            )
          })}
        </div>
      )}

      {!robot ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-steel-800">Робот не выбран</p>
          <p className="mt-1 text-xs text-steel-500">
            Нажмите на AMR на схеме или выберите вкладку выше.
          </p>
        </div>
      ) : (
        <div className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-semibold uppercase tracking-wide text-ink">
                {robot.label}
              </p>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-400">
                {robot.type} · автономный мобильный робот
              </p>
            </div>
            <StatusChip status={robot.status} />
          </div>

          <BatteryBar value={robot.battery} />

          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
            <Metric
              label="Скорость"
              value={`${formatNumber(robot.speedFactor * 1.2, 1)} м/с`}
              demo
            />
            <Metric label="Груз" value={`${formatNumber(robot.cargoKg, 0)} кг`} demo />
            <Metric label="Пройдено" value={formatNumber(robot.completedDistance, 2)} demo />
            <Metric label="Циклы" value={String(robot.cycles)} demo />
          </dl>

          <div className="mt-4 rounded border border-steel-100 bg-steel-50/60 p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-steel-400">
              Задание
            </p>
            {task ? (
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-steel-500">ID</dt>
                  <dd className="font-medium text-steel-900">{task.id}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-steel-500">Статус</dt>
                  <dd className="text-steel-800">{TASK_STATUS_RU[task.status]}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-steel-500">Откуда</dt>
                  <dd className="text-right text-steel-800">{task.source}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-steel-500">Куда</dt>
                  <dd className="text-right text-steel-800">{task.destination}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-steel-500">Нет активного задания</p>
            )}
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-steel-700">
            <input
              type="checkbox"
              checked={followRobot}
              onChange={(e) => onFollowChange(e.target.checked)}
              className="h-4 w-4 rounded border-steel-300 text-brand-600 focus:ring-brand-500"
            />
            Следовать за роботом в 3D
          </label>
        </div>
      )}
    </div>
  )
}

function StatusChip({ status }: { status: SimRobot['status'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-steel-200 bg-white px-2 py-1 text-xs font-medium text-steel-800">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: STATUS_COLOR[status] }}
        aria-hidden
      />
      {STATUS_LABEL_RU[status]}
    </span>
  )
}

function BatteryBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const tone = pct < 20 ? 'bg-red-600' : pct < 40 ? 'bg-amber-500' : 'bg-emerald-600'
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-steel-500">Батарея</span>
        <span className="font-medium tabular-nums text-steel-900">{formatNumber(pct, 0)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-steel-100" aria-hidden>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  demo,
}: {
  label: string
  value: string
  demo?: boolean
}) {
  return (
    <div className="rounded border border-steel-100 px-2.5 py-2">
      <dt className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-steel-400">
        {label}
        {demo ? (
          <span className="rounded-sm bg-steel-100 px-1 py-px text-[9px] tracking-wide text-steel-400">
            demo
          </span>
        ) : null}
      </dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}
