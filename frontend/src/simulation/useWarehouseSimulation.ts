import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CalculationSummary, VisualizationLayout } from '../types'
import type {
  LayerFlags,
  SimEvent,
  SimPlayState,
  SimRobot,
  SimTask,
  SimulationSnapshot,
  TaskStatusCode,
} from './types'
import { DEFAULT_LAYERS } from './types'
import { applySafetyStep, CONFLICT_RADIUS_PX, MAX_WAIT_SEC } from './robotSafety'
import { computeSimMetrics, emptyMetrics, isExecutableRoute, isTerminalTask } from './simMetrics'

const KPI_THROTTLE_MS = 200
const MAX_VISIBLE_ROBOTS = 6
const MAX_EVENTS = 24
/** Демо-скорость AMR, м/с — оценка без задержек погрузки. */
const DEMO_SPEED_MPS = 1.2

function clockLabel(elapsedSec: number) {
  const total = Math.floor(elapsedSec) % 86400
  const h = 14 + Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function mapTaskStatus(raw: string, blocked?: boolean): TaskStatusCode {
  if (blocked) return 'BLOCKED'
  const s = (raw || '').toLowerCase()
  if (s === 'blocked') return 'BLOCKED'
  if (s === 'assigned') return 'ASSIGNED'
  if (s === 'queued') return 'QUEUED'
  if (s === 'completed') return 'COMPLETED'
  if (s === 'navigating') return 'NAVIGATING'
  if (s === 'waiting') return 'WAITING'
  return 'QUEUED'
}

function pickNextTask(tasks: SimTask[], robotId: string): SimTask | null {
  return (
    tasks.find(
      (tk) =>
        !tk.robotId &&
        tk.status === 'QUEUED' &&
        isExecutableRoute(tk) &&
        !isTerminalTask(tk.status),
    ) ||
    tasks.find(
      (tk) =>
        tk.robotId === robotId &&
        tk.status === 'QUEUED' &&
        isExecutableRoute(tk),
    ) ||
    null
  )
}

interface UseWarehouseSimulationArgs {
  layout: VisualizationLayout
  calculation: CalculationSummary
  scenarioId?: string
}

export function useWarehouseSimulation({
  layout,
  calculation,
  scenarioId,
}: UseWarehouseSimulationArgs) {
  const [play, setPlay] = useState<SimPlayState>('idle')
  const [speed, setSpeed] = useState(1)
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [followRobot, setFollowRobot] = useState(false)
  const [layers, setLayers] = useState<LayerFlags>({ ...DEFAULT_LAYERS })
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() => emptySnapshot())
  const [layoutStale, setLayoutStale] = useState(false)

  const playRef = useRef<SimPlayState>('idle')
  const speedRef = useRef(1)
  const elapsedRef = useRef(0)
  const rafRef = useRef(0)
  const lastTs = useRef(0)
  const lastKpiTs = useRef(0)
  const eventsRef = useRef<SimEvent[]>([])
  const robotsStateRef = useRef<SimRobot[]>([])
  const tasksRef = useRef<SimTask[]>([])
  const layoutKeyRef = useRef('')

  const noRobots = scenarioId === 'baseline'
  const totalRobots = noRobots ? 0 : calculation.robot_count
  const visibleRobots = Math.min(totalRobots, MAX_VISIBLE_ROBOTS)
  const robotsCapped = totalRobots > MAX_VISIBLE_ROBOTS
  const metersToPx = layout.metersToPx || 1

  const layoutKey = useMemo(() => {
    const zones = (layout.zones || []).map((z) => `${z.id}:${z.x}:${z.y}:${z.w}:${z.h}:${z.rotation || 0}`)
    return `${layout.width}x${layout.height}|${zones.join('|')}`
  }, [layout])

  const pushEvent = useCallback((text: string, robotId?: string) => {
    const next: SimEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      t: elapsedRef.current,
      clock: clockLabel(elapsedRef.current),
      text,
      robotId,
    }
    eventsRef.current = [next, ...eventsRef.current].slice(0, MAX_EVENTS)
  }, [])

  const buildSnapshot = useCallback(
    (
      playState: SimPlayState,
      robots: SimRobot[],
      tasks: SimTask[],
      collisions: SimulationSnapshot['collisions'] = [],
    ): SimulationSnapshot => {
      const metrics = computeSimMetrics({
        play: playState,
        robots,
        tasks,
        configuredRobots: totalRobots,
        visibleRobots,
        robotsCapped,
      })
      const activeRobots = metrics.movingRobots + metrics.waitingRobots
      return {
        play: playState,
        phase: metrics.phase,
        speed: speedRef.current,
        progress: 0,
        robots,
        tasks: [...tasks],
        events: [...eventsRef.current],
        collisions,
        kpi: {
          distance: metrics.acceptedDistanceMeters,
          cycles: robots.reduce((s, r) => s + r.cycles, 0),
          completedTasks: metrics.completedTasks,
          activeRobots,
          avgSpeed: DEMO_SPEED_MPS,
          activityPct:
            robots.length > 0 ? Math.round((activeRobots / robots.length) * 100) : 0,
        },
        metrics,
        robotsCapped,
        totalRobots,
        visibleRobots,
      }
    },
    [robotsCapped, totalRobots, visibleRobots],
  )

  const buildTasks = useCallback((): SimTask[] => {
    const fromApi = layout.tasks || []
    if (fromApi.length) {
      return fromApi.map((t) => {
        const blocked = Boolean(t.blocked) || String(t.status).toLowerCase() === 'blocked'
        const planned = Number(t.length_m || 0)
        const points = blocked ? [] : t.points || []
        const executable =
          blocked || points.length < 2 ? 0 : planned > 0 ? planned : 0
        return {
          id: t.id,
          status: mapTaskStatus(t.status, blocked),
          robotId: t.robot_id,
          source: t.source_name || t.source_id || '—',
          destination: t.destination_name || t.destination_id || '—',
          sourceId: t.source_id,
          destinationId: t.destination_id,
          taskType: t.type,
          cargoWeight: 200,
          createdAt: Date.now(),
          startedAt: null,
          completedAt: null,
          blockedReason: t.blocked_reason || null,
          routeId: t.route_id,
          routePoints: points,
          lengthM: executable,
          executableLengthM: executable,
          plannedLengthM: planned > 0 ? planned : null,
          blocked,
          conflictWith: null,
        }
      })
    }
    return (layout.routes || []).map((r, i) => {
      const blocked = Boolean(r.blocked)
      const planned = Number(r.length_m || 0)
      const points = blocked ? [] : r.points || []
      const executable = blocked || points.length < 2 ? 0 : planned
      return {
        id: `legacy_${r.id || i}`,
        status: blocked ? ('BLOCKED' as TaskStatusCode) : ('QUEUED' as TaskStatusCode),
        robotId: null,
        source: 'Приёмка',
        destination: 'Отгрузка',
        cargoWeight: 200,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        blockedReason: blocked ? r.blocked_reason || 'Маршрут недоступен' : null,
        routeId: r.id,
        routePoints: points,
        lengthM: executable,
        executableLengthM: executable,
        plannedLengthM: planned > 0 ? planned : null,
        blocked,
        conflictWith: null,
      }
    })
  }, [layout.routes, layout.tasks])

  const bootstrap = useCallback(() => {
    elapsedRef.current = 0
    lastTs.current = 0
    eventsRef.current = []
    layoutKeyRef.current = layoutKey
    setLayoutStale(false)

    const tasks = buildTasks()
    const fromLayout = (layout.robots || []).slice(0, visibleRobots)
    const robots: SimRobot[] = []
    const claimed = new Set<string>()

    for (let i = 0; i < visibleRobots; i++) {
      const src = fromLayout[i]
      const robotId = src?.id || `robot_${i + 1}`
      let task =
        tasks.find(
          (t) =>
            t.robotId === src?.id &&
            !isTerminalTask(t.status) &&
            isExecutableRoute(t) &&
            !claimed.has(t.id),
        ) ||
        tasks.find(
          (t) =>
            !t.robotId &&
            t.status === 'QUEUED' &&
            isExecutableRoute(t) &&
            !claimed.has(t.id),
        ) ||
        null

      if (task) {
        claimed.add(task.id)
        task = { ...task, robotId, status: 'ASSIGNED' }
        const idx = tasks.findIndex((t) => t.id === task!.id)
        if (idx >= 0) tasks[idx] = task
      }

      const pts = task?.routePoints || []
      const start = pts[0]
      const noRoute = !task || !isExecutableRoute(task)
      robots.push({
        id: robotId,
        label: `R${i + 1}`,
        type: 'AMR',
        x: start?.x ?? src?.x ?? layout.width * 0.1,
        y: start?.y ?? src?.y ?? layout.height * 0.9,
        heading: 0,
        speedFactor: src?.speed || 1 + (i % 3) * 0.15,
        speedMps: DEMO_SPEED_MPS,
        status: noRoute ? 'IDLE' : 'IDLE',
        battery: 92 - i * 7,
        cargoKg: 0,
        routeId: task?.routeId || '',
        taskId: task && isExecutableRoute(task) ? task.id : null,
        routeDistPx: 0,
        completedDistance: 0,
        cycles: 0,
        phase: 0,
        waitSec: 0,
        waitReason: null,
        conflictWith: null,
      })
    }

    // задания с blocked маршрутом остаются BLOCKED без робота
    for (const t of tasks) {
      if (t.blocked || t.status === 'BLOCKED') {
        t.status = 'BLOCKED'
        t.routePoints = []
        t.lengthM = 0
        t.executableLengthM = 0
        t.robotId = null
      }
    }

    tasksRef.current = tasks
    robotsStateRef.current = robots
    setSelectedRobotId(robots[0]?.id ?? null)
    setSelectedTaskId(robots[0]?.taskId ?? tasks[0]?.id ?? null)
    setSnapshot(buildSnapshot('idle', robots, tasks))
  }, [buildSnapshot, buildTasks, layout.height, layout.robots, layout.width, layoutKey, visibleRobots])

  useEffect(() => {
    playRef.current = play
  }, [play])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    if (layoutKeyRef.current && layoutKeyRef.current !== layoutKey && playRef.current !== 'idle') {
      setLayoutStale(true)
    }
    bootstrap()
    setPlay('idle')
  }, [bootstrap, layoutKey])

  useEffect(() => {
    const tick = (t: number) => {
      if (playRef.current === 'running' && robotsStateRef.current.length > 0) {
        const dt = lastTs.current ? (t - lastTs.current) / 1000 : 0
        lastTs.current = t
        if (dt > 0) {
          elapsedRef.current += dt * speedRef.current
        }

        const tasks = tasksRef.current
        const safetyIn = robotsStateRef.current.map((robot) => {
          const task = tasks.find((tk) => tk.id === robot.taskId)
          const executable = task ? isExecutableRoute(task) : false
          const pts = executable ? task!.routePoints : []
          return {
            id: robot.id,
            x: robot.x,
            y: robot.y,
            routeDistPx: robot.routeDistPx,
            status: robot.status,
            waitSec: robot.waitSec || 0,
            completedDistance: robot.completedDistance,
            speedMps: robot.speedMps,
            speedFactor: robot.speedFactor,
            routePoints: pts,
            taskBlocked: Boolean(task && !executable),
            conflictWith: robot.conflictWith,
          }
        })

        const { robots: stepped, collisions } = applySafetyStep({
          robots: safetyIn,
          dtSec: dt,
          simSpeed: speedRef.current,
          metersToPx,
          conflictRadiusPx: CONFLICT_RADIUS_PX,
          maxWaitSec: MAX_WAIT_SEC,
        })

        const nextRobots = robotsStateRef.current.map((robot) => {
          const s = stepped.find((x) => x.id === robot.id)
          if (!s) return robot
          const task = tasks.find((tk) => tk.id === robot.taskId)
          let status = s.status as SimRobot['status']
          let waitReason: string | null = null
          let heading = robot.heading
          let battery = robot.battery
          let cargoKg = robot.cargoKg
          let cycles = robot.cycles
          let taskId = robot.taskId
          let routeId = robot.routeId
          let routeDistPx = s.routeDistPx
          let x = s.x
          let y = s.y
          let conflictWith = s.conflictWith ?? null

          if (status === 'WAITING') {
            waitReason = conflictWith
              ? `Ожидание: конфликт с ${conflictWith} (приоритет по id, демо-reservation)`
              : 'Ожидание: конфликт зоны (приоритет по id, демо-reservation)'
            if (task && !isTerminalTask(task.status)) {
              task.status = 'WAITING'
              task.conflictWith = conflictWith
            }
          } else if (status === 'BLOCKED' && (s.waitSec || 0) >= MAX_WAIT_SEC) {
            waitReason = conflictWith
              ? `Таймаут ${MAX_WAIT_SEC} с: конфликт с ${conflictWith}`
              : `Таймаут ожидания ${MAX_WAIT_SEC} с — проход не освободился`
            if (task && task.status !== 'COMPLETED') {
              task.status = 'BLOCKED'
              task.blocked = true
              task.blockedReason = waitReason
              task.routePoints = []
              task.executableLengthM = 0
              task.lengthM = 0
              task.conflictWith = conflictWith
              task.robotId = null
            }
            taskId = null
            routeId = ''
            routeDistPx = 0
            conflictWith = conflictWith
            pushEvent(
              `${robot.label} → блокировка по таймауту${conflictWith ? ` (vs ${conflictWith})` : ''}`,
              robot.id,
            )
            // одно переназначение на другое исполняемое задание (без цикла на тот же task)
            const next = pickNextTask(tasks, robot.id)
            if (next) {
              next.robotId = robot.id
              next.status = 'ASSIGNED'
              taskId = next.id
              routeId = next.routeId || ''
              status = 'IDLE'
              waitReason = null
              conflictWith = null
              const n0 = next.routePoints[0]
              if (n0) {
                x = n0.x
                y = n0.y
              }
              pushEvent(`${robot.label} → переназначено ${next.id}`, robot.id)
            }
          } else if (status === 'MOVING' && task && isExecutableRoute(task)) {
            task.status = 'NAVIGATING'
            task.conflictWith = null
            if (!task.startedAt) task.startedAt = Date.now()
            if (dt > 0) battery = Math.max(12, battery - dt * 0.15)
            if (Math.hypot(x - robot.x, y - robot.y) > 0.01) {
              heading = Math.atan2(y - robot.y, x - robot.x)
            }
          } else if (status === 'IDLE' && task && (task.status === 'NAVIGATING' || task.status === 'WAITING')) {
            task.status = 'COMPLETED'
            task.completedAt = Date.now()
            task.blocked = false
            cycles += 1
            cargoKg = task.taskType === 'outbound' || task.taskType === 'transfer' ? 0 : 200
            routeDistPx = 0
            pushEvent(`${robot.label} → задание ${task.id} завершено`, robot.id)
            const next = pickNextTask(tasks, robot.id)
            if (next) {
              next.robotId = robot.id
              next.status = 'ASSIGNED'
              taskId = next.id
              routeId = next.routeId || ''
              const n0 = next.routePoints[0]
              if (n0) {
                x = n0.x
                y = n0.y
              }
              pushEvent(`${robot.label} → назначено ${next.id}`, robot.id)
            } else {
              taskId = null
              routeId = ''
            }
          } else if (task && (task.status === 'BLOCKED' || task.blocked)) {
            status = 'IDLE'
            waitReason = task.blockedReason || 'Нет маршрута'
            taskId = null
            routeId = ''
            routeDistPx = 0
            conflictWith = null
          }

          return {
            ...robot,
            x,
            y,
            heading,
            status,
            waitSec: s.waitSec,
            waitReason,
            battery,
            cargoKg,
            cycles,
            taskId,
            routeId,
            routeDistPx,
            completedDistance: s.completedDistance,
            conflictWith,
          }
        })

        robotsStateRef.current = nextRobots
        tasksRef.current = tasks

        const snap = buildSnapshot(playRef.current, nextRobots, tasks, collisions)
        // авто-остановка тика визуально: play остаётся running, phase=completed|stalled
        if (snap.phase === 'completed' || snap.phase === 'stalled') {
          // оставляем play=running для отличия «нажали старт», но phase говорит UI правду
        }

        if (t - lastKpiTs.current >= KPI_THROTTLE_MS) {
          lastKpiTs.current = t
          setSnapshot(snap)
        }
      } else {
        lastTs.current = 0
        if (t - lastKpiTs.current >= KPI_THROTTLE_MS) {
          lastKpiTs.current = t
          setSnapshot(
            buildSnapshot(playRef.current, robotsStateRef.current, tasksRef.current),
          )
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [buildSnapshot, metersToPx, pushEvent])

  const start = useCallback(() => {
    pushEvent('Симуляция запущена (задания с индивидуальными маршрутами)')
    setPlay('running')
  }, [pushEvent])

  const pause = useCallback(() => setPlay('paused'), [])

  const reset = useCallback(() => {
    setPlay('idle')
    bootstrap()
  }, [bootstrap])

  const toggleLayer = useCallback((key: keyof LayerFlags) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const selectedRobot = snapshot.robots.find((r) => r.id === selectedRobotId) || null
  const selectedTask =
    (selectedTaskId && snapshot.tasks.find((t) => t.id === selectedTaskId)) ||
    (selectedRobot?.taskId != null
      ? snapshot.tasks.find((t) => t.id === selectedRobot.taskId) || null
      : null)

  return {
    snapshot,
    layers,
    toggleLayer,
    setLayers,
    selectedRobotId,
    setSelectedRobotId,
    selectedTaskId,
    setSelectedTaskId,
    selectedRobot,
    selectedTask,
    followRobot,
    setFollowRobot,
    play,
    speed,
    setSpeed,
    start,
    pause,
    reset,
    layout,
    layoutStale,
    maxVisibleRobots: MAX_VISIBLE_ROBOTS,
  }
}

function emptySnapshot(): SimulationSnapshot {
  const metrics = emptyMetrics()
  return {
    play: 'idle',
    phase: 'ready',
    speed: 1,
    progress: 0,
    robots: [],
    tasks: [],
    events: [],
    collisions: [],
    kpi: {
      distance: 0,
      cycles: 0,
      completedTasks: 0,
      activeRobots: 0,
      avgSpeed: 0,
      activityPct: 0,
    },
    metrics,
    robotsCapped: false,
    totalRobots: 0,
    visibleRobots: 0,
  }
}

export type WarehouseSimulation = ReturnType<typeof useWarehouseSimulation>
