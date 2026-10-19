/**
 * Единый источник KPI и фазы DES. UI не должен пересчитывать статусы иначе.
 *
 * Соответствие API → UI:
 * queued→QUEUED, assigned→ASSIGNED, navigating→NAVIGATING,
 * waiting→WAITING, completed→COMPLETED, blocked→BLOCKED.
 */

import type {
  SimMetrics,
  SimPhase,
  SimPlayState,
  SimRobot,
  SimTask,
  SimulationSnapshot,
  TaskStatusCode,
} from './types'

const ACTIVE_TASK: ReadonlySet<TaskStatusCode> = new Set([
  'ASSIGNED',
  'NAVIGATING',
  'WAITING',
  'MOVING_TO_PICKUP',
  'LOADING',
  'MOVING_TO_DESTINATION',
  'UNLOADING',
])

export function isTerminalTask(status: TaskStatusCode): boolean {
  return status === 'COMPLETED' || status === 'BLOCKED' || status === 'CANCELLED'
}

export function isExecutableRoute(task: SimTask): boolean {
  if (task.blocked || task.status === 'BLOCKED') return false
  return Boolean(task.routePoints && task.routePoints.length >= 2)
}

/** Длина для отображения как «действующий маршрут»; у blocked — null. */
export function displayRouteLengthM(task: SimTask): number | null {
  if (task.blocked || task.status === 'BLOCKED') return null
  const len = task.executableLengthM ?? task.lengthM
  if (len == null || len <= 0) return null
  return len
}

export function deriveSimPhase(args: {
  play: SimPlayState
  tasks: SimTask[]
  robots: SimRobot[]
}): SimPhase {
  const { play, tasks, robots } = args
  if (play === 'idle') return 'ready'
  if (play === 'paused') return 'paused'

  const allTerminal = tasks.length > 0 && tasks.every((t) => isTerminalTask(t.status))
  if (allTerminal) return 'completed'

  const moving = robots.some((r) => r.status === 'MOVING')
  const waiting = robots.some((r) => r.status === 'WAITING')
  const activeExecutable = tasks.some((t) => ACTIVE_TASK.has(t.status) && isExecutableRoute(t))
  const hasQueuedExecutable = tasks.some((t) => t.status === 'QUEUED' && isExecutableRoute(t))

  if (play === 'running' && !moving && !waiting && !activeExecutable && !hasQueuedExecutable) {
    return 'stalled'
  }

  return 'running'
}

export function computeSimMetrics(args: {
  play: SimPlayState
  robots: SimRobot[]
  tasks: SimTask[]
  configuredRobots: number
  visibleRobots: number
  robotsCapped: boolean
}): SimMetrics {
  const { play, robots, tasks, configuredRobots, visibleRobots, robotsCapped } = args

  const movingRobots = robots.filter((r) => r.status === 'MOVING').length
  const idleRobots = robots.filter((r) => r.status === 'IDLE').length
  const waitingRobots = robots.filter((r) => r.status === 'WAITING').length
  const blockedRobots = robots.filter((r) => r.status === 'BLOCKED').length

  const activeTasks = tasks.filter((t) => ACTIVE_TASK.has(t.status)).length
  const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED' || Boolean(t.blocked)).length
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length
  const unassignedTasks = tasks.filter((t) => !t.robotId && t.status === 'QUEUED').length
  const queuedTasks = tasks.filter((t) => t.status === 'QUEUED').length

  const acceptedDistanceMeters = robots.reduce((s, r) => s + (r.completedDistance || 0), 0)

  return {
    configuredRobots,
    visibleRobots,
    movingRobots,
    idleRobots,
    waitingRobots,
    blockedRobots,
    activeTasks,
    blockedTasks,
    completedTasks,
    unassignedTasks,
    queuedTasks,
    acceptedDistanceMeters,
    phase: deriveSimPhase({ play, tasks, robots }),
    robotsCapped,
  }
}

export function metricsFromSnapshot(snapshot: SimulationSnapshot): SimMetrics {
  return (
    snapshot.metrics ||
    computeSimMetrics({
      play: snapshot.play,
      robots: snapshot.robots,
      tasks: snapshot.tasks,
      configuredRobots: snapshot.totalRobots,
      visibleRobots: snapshot.visibleRobots,
      robotsCapped: snapshot.robotsCapped,
    })
  )
}

export const PHASE_LABEL_RU: Record<SimPhase, string> = {
  ready: 'Ожидание',
  running: 'Идёт',
  paused: 'Пауза',
  completed: 'Завершено',
  stalled: 'Нет прогресса',
}

export function emptyMetrics(): SimMetrics {
  return {
    configuredRobots: 0,
    visibleRobots: 0,
    movingRobots: 0,
    idleRobots: 0,
    waitingRobots: 0,
    blockedRobots: 0,
    activeTasks: 0,
    blockedTasks: 0,
    completedTasks: 0,
    unassignedTasks: 0,
    queuedTasks: 0,
    acceptedDistanceMeters: 0,
    phase: 'ready',
    robotsCapped: false,
  }
}
