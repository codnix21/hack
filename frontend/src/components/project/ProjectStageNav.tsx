import { Check, AlertTriangle, Circle } from 'lucide-react'

export type StageId =
  | 'object'
  | 'layout'
  | 'selection'
  | 'compare'
  | 'economics'
  | 'visualization'
  | 'report'

export type StageStatus = 'idle' | 'needs_data' | 'ready' | 'done' | 'warning'

export interface ProductStage {
  id: StageId
  label: string
  short: string
  description: string
  steps: string[]
}

export const PRODUCT_STAGES: ProductStage[] = [
  {
    id: 'object',
    label: 'Объект и исходные данные',
    short: 'Данные',
    description: 'Параметры склада и режим работы',
    steps: ['object', 'params', 'import'],
  },
  {
    id: 'layout',
    label: 'Планировка склада',
    short: 'План',
    description: 'Зоны, стеллажи, маршруты',
    steps: ['layout'],
  },
  {
    id: 'selection',
    label: 'Подбор оборудования',
    short: 'Подбор',
    description: 'Предварительная пригодность решений',
    steps: ['selection'],
  },
  {
    id: 'compare',
    label: 'Сравнение решений',
    short: 'Сравнение',
    description: 'Отличия выбранных вариантов',
    steps: ['compare'],
  },
  {
    id: 'economics',
    label: 'Экономика и сценарии',
    short: 'Экономика',
    description: 'Инвестиции, эффект, окупаемость',
    steps: ['economics', 'scenarios', 'fleet'],
  },
  {
    id: 'visualization',
    label: 'Моделирование',
    short: 'DES',
    description: 'Симуляция сценария (не цифровой двойник)',
    steps: ['visualization'],
  },
  {
    id: 'report',
    label: 'Итоговый отчёт',
    short: 'Отчёт',
    description: 'Резюме и экспорт PDF/Excel',
    steps: ['report', 'results', 'presentation'],
  },
]

export function resolveProductStage(step: string): StageId {
  for (const s of PRODUCT_STAGES) {
    if (s.steps.includes(step)) return s.id
  }
  return 'object'
}

export function defaultStepForStage(stage: StageId): string {
  const s = PRODUCT_STAGES.find((x) => x.id === stage)
  return s?.steps[0] || 'object'
}

const STATUS_RU: Record<StageStatus, string> = {
  idle: 'Не начат',
  needs_data: 'Нужны данные',
  ready: 'Готов',
  done: 'Готово',
  warning: 'Проверьте',
}

interface ProjectStageNavProps {
  active: StageId
  statuses: Partial<Record<StageId, StageStatus>>
  onChange: (stage: StageId) => void
  recommended?: StageId
}

export function ProjectStageNav({
  active,
  statuses,
  onChange,
  recommended,
}: ProjectStageNavProps) {
  return (
    <nav aria-label="Этапы проекта" className="mb-0" data-testid="project-stage-nav">
      <ol className="hidden space-y-px lg:block">
        {PRODUCT_STAGES.map((stage) => {
          const st = statuses[stage.id] || 'idle'
          const isActive = active === stage.id
          const isRec = recommended === stage.id && !isActive
          return (
            <li key={stage.id}>
              <button
                type="button"
                onClick={() => onChange(stage.id)}
                title={`${stage.label}: ${STATUS_RU[st]}`}
                className={`nc-focusable flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition ${
                  isActive
                    ? 'bg-[var(--nc-accent-soft)] font-medium text-[var(--nc-ink)]'
                    : isRec
                      ? 'bg-[var(--nc-accent-soft)] text-[var(--nc-ink)]'
                      : 'text-[var(--nc-text)] hover:bg-[var(--nc-surface-hover)]'
                }`}
              >
                <StatusIcon status={st} active={isActive} />
                <span className="min-w-0 flex-1 truncate text-sm">{stage.short}</span>
                {isRec ? (
                  <span className="shrink-0 text-[10px] font-medium text-[var(--nc-accent)]">далее</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>

      <div className="lg:hidden">
        <label className="sr-only" htmlFor="project-stage-select">
          Этап проекта
        </label>
        <select
          id="project-stage-select"
          className="nc-control nc-focusable w-full border border-[var(--nc-border-strong)] bg-[var(--nc-surface)] px-2 text-sm"
          value={active}
          onChange={(e) => onChange(e.target.value as StageId)}
          aria-label="Этап проекта"
        >
          {PRODUCT_STAGES.map((stage, idx) => {
            const st = statuses[stage.id] || 'idle'
            return (
              <option key={stage.id} value={stage.id}>
                {idx + 1}. {stage.short} — {STATUS_RU[st]}
              </option>
            )
          })}
        </select>
      </div>
    </nav>
  )
}

function StatusIcon({ status, active }: { status: StageStatus; active?: boolean }) {
  if (status === 'done')
    return <Check className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[var(--nc-accent)]' : 'text-[var(--nc-lime)]'}`} aria-hidden />
  if (status === 'warning' || status === 'needs_data')
    return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--nc-warning)]" aria-hidden />
  if (status === 'ready')
    return <Circle className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[var(--nc-accent)]' : 'text-brand-400'}`} aria-hidden />
  return <Circle className="h-3.5 w-3.5 shrink-0 text-[var(--nc-faint)]" aria-hidden />
}
