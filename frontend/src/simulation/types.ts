/** Типы демонстрационной симуляции склада (не Digital Twin). */

/** Управление кнопкой play/pause (не путать с фазой модели). */
export type SimPlayState = 'idle' | 'running' | 'paused'
/** Фаза модели DES — источник истины для статус-бейджа. */
export type SimPhase = 'ready' | 'running' | 'paused' | 'completed' | 'stalled'
export type ViewMode = '2d' | 'isometric' | '3d'

/** Единый контракт KPI — заполняется computeSimMetrics, не UI. */
export interface SimMetrics {
  configuredRobots: number
  visibleRobots: number
  movingRobots: number
  idleRobots: number
  waitingRobots: number
  blockedRobots: number
  activeTasks: number
  blockedTasks: number
  completedTasks: number
  unassignedTasks: number
  queuedTasks: number
  acceptedDistanceMeters: number
  phase: SimPhase
  robotsCapped: boolean
}

export type RobotStatusCode =
  | 'IDLE'
  | 'MOVING'
  | 'LOADING'
  | 'UNLOADING'
  | 'CHARGING'
  | 'WAITING'
  | 'BLOCKED'
  | 'ERROR'

export type TaskStatusCode =
  | 'QUEUED'
  | 'ASSIGNED'
  | 'NAVIGATING'
  | 'WAITING'
  | 'MOVING_TO_PICKUP'
  | 'LOADING'
  | 'MOVING_TO_DESTINATION'
  | 'UNLOADING'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'CANCELLED'

export interface SimRobot {
  id: string
  label: string
  type: 'AMR'
  x: number
  y: number
  /** Радианы, 0 = вправо */
  heading: number
  speedFactor: number
  /** Демо-скорость м/с (оценка) */
  speedMps: number
  status: RobotStatusCode
  battery: number
  cargoKg: number
  routeId: string
  taskId: string | null
  /** Пройдено по текущему маршруту, пиксели сцены */
  routeDistPx: number
  completedDistance: number
  cycles: number
  phase: number
  /** накопленное ожидание из‑за конфликта, сек симуляции */
  waitSec: number
  waitReason?: string | null
  conflictWith?: string | null
}

export interface SimTask {
  id: string
  status: TaskStatusCode
  robotId: string | null
  source: string
  destination: string
  sourceId?: string
  destinationId?: string
  taskType?: string
  cargoWeight: number
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  blockedReason?: string | null
  routeId?: string
  routePoints: { x: number; y: number }[]
  /** Длина исполняемого маршрута (0 / undefined если blocked). */
  lengthM?: number
  /** То же, что lengthM для исполняемого; явный контракт. */
  executableLengthM?: number
  /** Диагностическая длина / прежний план — не показывать как действующий маршрут. */
  plannedLengthM?: number | null
  blocked?: boolean
  conflictWith?: string | null
}

export interface SimEvent {
  id: string
  t: number
  clock: string
  text: string
  robotId?: string
}

export interface SimCollision {
  a: string
  b: string
  x: number
  y: number
}

export interface LayerFlags {
  robots: boolean
  shelves: boolean
  routes: boolean
  zones: boolean
  tasks: boolean
  heatmap: boolean
  directions: boolean
  collisions: boolean
}

export interface SimulationSnapshot {
  play: SimPlayState
  /** Фаза модели (ready/running/paused/completed/stalled). */
  phase: SimPhase
  speed: number
  progress: number
  robots: SimRobot[]
  tasks: SimTask[]
  events: SimEvent[]
  collisions: SimCollision[]
  /** @deprecated используйте metrics — оставлено для совместимости панелей. */
  kpi: {
    distance: number
    cycles: number
    completedTasks: number
    activeRobots: number
    avgSpeed: number
    activityPct: number
  }
  metrics: SimMetrics
  robotsCapped: boolean
  totalRobots: number
  visibleRobots: number
}

export const DEFAULT_LAYERS: LayerFlags = {
  robots: true,
  shelves: true,
  routes: true,
  zones: true,
  tasks: true,
  heatmap: false,
  directions: true,
  collisions: false,
}

export const STATUS_LABEL_RU: Record<RobotStatusCode, string> = {
  IDLE: 'Ожидает',
  MOVING: 'Выполняет задание',
  LOADING: 'Погрузка',
  UNLOADING: 'Разгрузка',
  CHARGING: 'Заряжается',
  WAITING: 'Ждёт (конфликт)',
  BLOCKED: 'Маршрут недоступен',
  ERROR: 'Ошибка',
}

export const STATUS_SHORT_RU: Record<RobotStatusCode, string> = {
  IDLE: 'Стоп',
  MOVING: 'Идёт',
  LOADING: 'Груз',
  UNLOADING: 'Разгр.',
  CHARGING: 'ЗС',
  WAITING: 'Ждёт',
  BLOCKED: 'Нет пути',
  ERROR: 'Ошибка',
}

export const TASK_STATUS_RU: Record<TaskStatusCode, string> = {
  QUEUED: 'В очереди',
  ASSIGNED: 'Назначено',
  NAVIGATING: 'В пути',
  WAITING: 'Ожидание (конфликт)',
  MOVING_TO_PICKUP: 'К точке забора',
  LOADING: 'Погрузка',
  MOVING_TO_DESTINATION: 'К назначению',
  UNLOADING: 'Разгрузка',
  COMPLETED: 'Завершено',
  BLOCKED: 'Маршрут недоступен',
  CANCELLED: 'Отменено',
}

export const STATUS_COLOR: Record<RobotStatusCode, string> = {
  IDLE: '#64748b',
  MOVING: '#14171c',
  LOADING: '#c2410c',
  UNLOADING: '#1d4ed8',
  CHARGING: '#15803d',
  WAITING: '#b45309',
  BLOCKED: '#b91c1c',
  ERROR: '#b91c1c',
}
