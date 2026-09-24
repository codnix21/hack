/** Типы демонстрационной симуляции склада (не Digital Twin). */

export type SimPlayState = 'idle' | 'running' | 'paused'
export type ViewMode = '2d' | 'isometric' | '3d'

export type RobotStatusCode =
  | 'IDLE'
  | 'MOVING'
  | 'LOADING'
  | 'UNLOADING'
  | 'CHARGING'
  | 'ERROR'

export type TaskStatusCode =
  | 'QUEUED'
  | 'ASSIGNED'
  | 'MOVING_TO_PICKUP'
  | 'LOADING'
  | 'MOVING_TO_DESTINATION'
  | 'UNLOADING'
  | 'COMPLETED'

export interface SimRobot {
  id: string
  label: string
  type: 'AMR'
  x: number
  y: number
  /** Радианы, 0 = вправо */
  heading: number
  speedFactor: number
  status: RobotStatusCode
  battery: number
  cargoKg: number
  routeId: string
  taskId: string | null
  completedDistance: number
  cycles: number
  phase: number
}

export interface SimTask {
  id: string
  status: TaskStatusCode
  robotId: string | null
  source: string
  destination: string
  cargoWeight: number
  createdAt: number
  startedAt: number | null
  completedAt: number | null
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
  speed: number
  progress: number
  robots: SimRobot[]
  tasks: SimTask[]
  events: SimEvent[]
  collisions: SimCollision[]
  kpi: {
    distance: number
    cycles: number
    completedTasks: number
    activeRobots: number
    avgSpeed: number
    activityPct: number
  }
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
  directions: false,
  collisions: false,
}

export const STATUS_LABEL_RU: Record<RobotStatusCode, string> = {
  IDLE: 'Ожидает',
  MOVING: 'Выполняет задание',
  LOADING: 'Погрузка',
  UNLOADING: 'Разгрузка',
  CHARGING: 'Заряжается',
  ERROR: 'Ошибка',
}

export const STATUS_SHORT_RU: Record<RobotStatusCode, string> = {
  IDLE: 'Стоп',
  MOVING: 'Идёт',
  LOADING: 'Груз',
  UNLOADING: 'Разгр.',
  CHARGING: 'ЗС',
  ERROR: 'Ошибка',
}

export const TASK_STATUS_RU: Record<TaskStatusCode, string> = {
  QUEUED: 'В очереди',
  ASSIGNED: 'Назначено',
  MOVING_TO_PICKUP: 'К точке забора',
  LOADING: 'Погрузка',
  MOVING_TO_DESTINATION: 'К назначению',
  UNLOADING: 'Разгрузка',
  COMPLETED: 'Завершено',
}

export const STATUS_COLOR: Record<RobotStatusCode, string> = {
  IDLE: '#64748b',
  MOVING: '#14171c',
  LOADING: '#c2410c',
  UNLOADING: '#1d4ed8',
  CHARGING: '#15803d',
  ERROR: '#b91c1c',
}
