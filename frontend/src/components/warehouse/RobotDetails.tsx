import type { SimRobot, SimTask } from '../../simulation/types'
import { STATUS_COLOR, STATUS_LABEL_RU, TASK_STATUS_RU } from '../../simulation/types'
import { displayRouteLengthM } from '../../simulation/simMetrics'
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
    <div className="overflow-hidden rounded border border-[var(--nc-border)] bg-[var(--nc-surface)] shadow-panel">
      {robots.length > 0 && (
        <div className="flex gap-1 border-b border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] p-1.5">
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
                    ? 'bg-[var(--nc-accent-soft)] text-[var(--nc-ink)] ring-1 ring-[var(--nc-accent-line)]'
                    : 'text-[var(--nc-text)] hover:bg-[var(--nc-surface-hover)] hover:text-[var(--nc-ink)]'
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
        <div className="px-3 py-5 text-center">
          <p className="text-sm font-medium text-[var(--nc-ink)]">Робот не выбран</p>
          <p className="mt-1 text-xs text-[var(--nc-text)]">
            Нажмите на AMR на схеме или выберите вкладку выше.
          </p>
        </div>
      ) : (
        <div className="p-3">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="nc-title-sm text-base">{robot.label}</p>
              <p className="mt-0.5 text-xs text-[var(--nc-text)]">{robot.type} · AMR</p>
            </div>
            <StatusChip status={robot.status} />
          </div>

          <BatteryBar value={robot.battery} />

          {robot.waitReason ? (
            <p className="mt-2 rounded border border-[rgba(245,193,74,0.45)] bg-[var(--nc-warning-soft)] px-2 py-1.5 text-xs text-[var(--nc-warning)]">
              {robot.waitReason}
            </p>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric
              label="Скорость"
              value={`${formatNumber(robot.speedMps * robot.speedFactor, 1)} м/с`}
              fill={Math.min(100, ((robot.speedMps * robot.speedFactor) / 2) * 100)}
              accent="var(--nc-accent)"
            />
            <Metric
              label="Груз"
              value={`${formatNumber(robot.cargoKg, 0)} кг`}
              fill={Math.min(100, robot.cargoKg / 5)}
              accent="var(--nc-cyan)"
            />
            <Metric
              label="Пройдено"
              value={`${formatNumber(robot.completedDistance, 1)} м`}
              fill={Math.min(100, robot.completedDistance / 2)}
              accent="var(--nc-lime)"
            />
            <Metric
              label="Циклы"
              value={String(robot.cycles)}
              fill={Math.min(100, robot.cycles * 20)}
              accent="var(--nc-info)"
            />
          </div>

          <div className="mt-3 overflow-hidden rounded border border-[var(--nc-border)] bg-[var(--nc-surface-muted)]">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--nc-border-subtle)] bg-[var(--nc-surface-raised)] px-2.5 py-1.5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nc-ink)]">
                Задание
              </p>
              {task ? (
                <span className="rounded border border-[rgba(198,242,58,0.35)] bg-[var(--nc-lime-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--nc-lime)]">
                  {TASK_STATUS_RU[task.status]}
                </span>
              ) : null}
            </div>
            {task ? (
              <div className="space-y-2.5 p-2.5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <FlowNode label="Откуда" value={task.source} />
                  <span className="font-mono text-sm text-[var(--nc-accent)]" aria-hidden>
                    →
                  </span>
                  <FlowNode label="Куда" value={task.destination} align="right" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--nc-border-subtle)] pt-2 text-xs">
                  <span className="font-mono text-[var(--nc-muted)]">ID {task.id}</span>
                  {displayRouteLengthM(task) != null ? (
                    <span className="font-semibold tabular-nums text-[var(--nc-ink)]">
                      {formatNumber(displayRouteLengthM(task)!, 1)} м маршрута
                    </span>
                  ) : null}
                </div>
                {task.blockedReason ? (
                  <p className="text-xs text-[var(--nc-danger)]">{task.blockedReason}</p>
                ) : null}
              </div>
            ) : (
              <p className="px-2.5 py-3 text-sm text-[var(--nc-text)]">Нет активного задания</p>
            )}
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-[var(--nc-text)]">
            <input
              type="checkbox"
              checked={followRobot}
              onChange={(e) => onFollowChange(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--nc-border)] text-[var(--nc-accent)] focus:ring-brand-500"
            />
            Следовать за роботом в 3D
          </label>
        </div>
      )}
    </div>
  )
}

function FlowNode({
  label,
  value,
  align = 'left',
}: {
  label: string
  value: string
  align?: 'left' | 'right'
}) {
  return (
    <div className={`min-w-0 rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface)] px-2 py-1.5 ${align === 'right' ? 'text-right' : ''}`}>
      <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--nc-muted)]">{label}</p>
      <p className="truncate text-sm font-semibold text-[var(--nc-ink)]" title={value}>
        {value}
      </p>
    </div>
  )
}

function StatusChip({ status }: { status: SimRobot['status'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--nc-border)] bg-[var(--nc-surface-raised)] px-2 py-1 text-xs font-medium text-[var(--nc-ink)]">
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
  const tone =
    pct < 20 ? 'var(--nc-danger)' : pct < 40 ? 'var(--nc-warning)' : 'var(--nc-lime)'
  return (
    <div className="rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-2.5 py-2">
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--nc-text)]">
          Батарея
        </span>
        <span className="font-display text-base font-semibold tabular-nums text-[var(--nc-ink)]">
          {formatNumber(pct, 0)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-sm bg-[var(--nc-surface-hover)]" aria-hidden>
        <div
          className="h-full rounded-sm transition-[width] duration-500"
          style={{ width: `${pct}%`, background: tone }}
        />
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  fill,
  accent,
}: {
  label: string
  value: string
  fill: number
  accent: string
}) {
  const pct = Math.max(4, Math.min(100, fill))
  return (
    <div className="rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-2.5 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--nc-text)]">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums leading-none text-[var(--nc-ink)]">
        {value}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-sm bg-[var(--nc-surface-hover)]" aria-hidden>
        <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: accent }} />
      </div>
    </div>
  )
}
