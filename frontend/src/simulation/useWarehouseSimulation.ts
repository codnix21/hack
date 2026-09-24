import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CalculationSummary, VisualizationLayout } from '../types'
import type {
  LayerFlags,
  SimEvent,
  SimPlayState,
  SimRobot,
  SimTask,
  SimulationSnapshot,
  RobotStatusCode,
  TaskStatusCode,
} from './types'
import { DEFAULT_LAYERS } from './types'

const KPI_THROTTLE_MS = 200
const NEAR_RADIUS = 28
const COLLISION_RADIUS = 36
const MAX_VISIBLE_ROBOTS = 6
const MAX_EVENTS = 24

function dist2(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by)
}

function isLoadType(type?: string) {
  const t = (type || '').toLowerCase()
  return t.includes('load') && !t.includes('unload')
}

function isUnloadType(type?: string) {
  const t = (type || '').toLowerCase()
  return t.includes('unload') || t.includes('разгруз') || t.includes('выгруз')
}

function clockLabel(elapsedSec: number) {
  const total = Math.floor(elapsedSec) % 86400
  const h = 14 + Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function pointOnRoute(
  points: { x: number; y: number }[],
  phase01: number,
): { x: number; y: number; heading: number; dist: number; total: number } {
  if (!points.length) return { x: 0, y: 0, heading: 0, dist: 0, total: 0 }
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    lengths.push(d)
    total += d
  }
  if (total === 0) {
    return { x: points[0].x, y: points[0].y, heading: 0, dist: 0, total: 0 }
  }
  const localT = ((phase01 % 1) + 1) % 1 * total
  let acc = 0
  for (let i = 0; i < lengths.length; i++) {
    if (acc + lengths[i] >= localT) {
      const f = (localT - acc) / lengths[i]
      const x0 = points[i].x
      const y0 = points[i].y
      const x1 = points[i + 1].x
      const y1 = points[i + 1].y
      return {
        x: x0 + (x1 - x0) * f,
        y: y0 + (y1 - y0) * f,
        heading: Math.atan2(y1 - y0, x1 - x0),
        dist: localT,
        total,
      }
    }
    acc += lengths[i]
  }
  const last = points[points.length - 1]
  const prev = points[points.length - 2] || last
  return {
    x: last.x,
    y: last.y,
    heading: Math.atan2(last.y - prev.y, last.x - prev.x),
    dist: total,
    total,
  }
}

function storageNames(layout: VisualizationLayout) {
  return (layout.zones || [])
    .filter((z) => (z.type || '') === 'storage')
    .map((z) => z.name)
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
  const [followRobot, setFollowRobot] = useState(false)
  const [layers, setLayers] = useState<LayerFlags>({ ...DEFAULT_LAYERS })
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() => emptySnapshot())

  const playRef = useRef<SimPlayState>('idle')
  const speedRef = useRef(1)
  const progressRef = useRef(0)
  const elapsedRef = useRef(0)
  const rafRef = useRef(0)
  const lastTs = useRef(0)
  const lastKpiTs = useRef(0)
  const eventsRef = useRef<SimEvent[]>([])
  const lastStatusRef = useRef<Record<string, RobotStatusCode>>({})
  const cycleLatchRef = useRef<Record<string, boolean>>({})
  const startedLatchRef = useRef(false)
  const robotsStateRef = useRef<SimRobot[]>([])
  const tasksRef = useRef<SimTask[]>([])
  const distanceAccRef = useRef<Record<string, number>>({})

  const noRobots = scenarioId === 'baseline'
  const totalRobots = noRobots ? 0 : calculation.robot_count
  const visibleRobots = Math.min(totalRobots, MAX_VISIBLE_ROBOTS)
  const robotsCapped = totalRobots > MAX_VISIBLE_ROBOTS

  const baseRobots = useMemo(() => {
    if (visibleRobots <= 0) return []
    const fromLayout = layout.robots || []
    const routes = layout.routes || []
    const result = [...fromLayout]
    for (let i = fromLayout.length; i < visibleRobots; i++) {
      const route = routes[i % Math.max(routes.length, 1)]
      result.push({
        id: `calc-robot-${i + 1}`,
        name: `Робот ${i + 1}`,
        route_id: route?.id || '',
        speed: 1 + (i % 3) * 0.2,
        x: route?.points?.[0]?.x,
        y: route?.points?.[0]?.y,
      })
    }
    return result.slice(0, visibleRobots)
  }, [layout.robots, layout.routes, visibleRobots])

  const pushEvent = useCallback((text: string, robotId?: string) => {
    const next: SimEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      t: progressRef.current,
      clock: clockLabel(elapsedRef.current),
      text,
      robotId,
    }
    const list = [next, ...eventsRef.current].slice(0, MAX_EVENTS)
    eventsRef.current = list
  }, [])

  const initTasks = useCallback(
    (robots: SimRobot[]) => {
      const racks = storageNames(layout)
      const sourceA = racks[0] || 'Стеллаж C1'
      const sourceB = racks[1] || racks[0] || 'Стеллаж C2'
      const tasks: SimTask[] = robots.map((r, i) => ({
        id: `TASK-${String(i + 1).padStart(3, '0')}`,
        status: 'ASSIGNED' as TaskStatusCode,
        robotId: r.id,
        source: i % 2 === 0 ? sourceA : sourceB,
        destination: 'Зона отгрузки',
        cargoWeight: 200 + i * 60,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
      }))
      tasksRef.current = tasks
      return tasks
    },
    [layout],
  )

  const bootstrap = useCallback(() => {
    progressRef.current = 0
    elapsedRef.current = 0
    lastStatusRef.current = {}
    cycleLatchRef.current = {}
    startedLatchRef.current = false
    eventsRef.current = []
    distanceAccRef.current = {}
    const w = layout.width || 800
    const h = layout.height || 500
    const robots: SimRobot[] = baseRobots.map((r, i) => {
      const route =
        (layout.routes || []).find((rt) => rt.id === r.route_id) ||
        layout.routes?.[i % Math.max(layout.routes?.length || 1, 1)]
      const pts = route?.points || []
      const start = pts[0]
      return {
        id: r.id,
        label: `R${i + 1}`,
        type: 'AMR',
        x: start?.x ?? r.x ?? w * 0.1,
        y: start?.y ?? r.y ?? h * 0.9,
        heading: 0,
        speedFactor: r.speed || 1 + (i % 3) * 0.15,
        status: 'IDLE',
        battery: 92 - i * 7,
        cargoKg: 0,
        routeId: route?.id || r.route_id || '',
        taskId: null,
        completedDistance: 0,
        cycles: 0,
        phase: i * 0.13,
      }
    })
    const tasks = initTasks(robots)
    robots.forEach((r, i) => {
      r.taskId = tasks[i]?.id ?? null
    })
    robotsStateRef.current = robots
    setSelectedRobotId(robots[0]?.id ?? null)
    setSnapshot({
      play: 'idle',
      speed: speedRef.current,
      progress: 0,
      robots,
      tasks,
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
      robotsCapped,
      totalRobots,
      visibleRobots,
    })
  }, [baseRobots, initTasks, layout, robotsCapped, totalRobots, visibleRobots])

  useEffect(() => {
    playRef.current = play
  }, [play])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    bootstrap()
    setPlay('idle')
  }, [bootstrap])

  useEffect(() => {
    const tick = (t: number) => {
      if (playRef.current === 'running' && robotsStateRef.current.length > 0) {
        const dt = lastTs.current ? (t - lastTs.current) / 1000 : 0
        lastTs.current = t
        const step = dt * 0.05 * speedRef.current
        progressRef.current = (progressRef.current + step) % 1
        elapsedRef.current += dt * speedRef.current
      } else {
        lastTs.current = 0
      }

      const progress = progressRef.current
      const nextRobots: SimRobot[] = robotsStateRef.current.map((robot, idx) => {
        const route =
          (layout.routes || []).find((r) => r.id === robot.routeId) ||
          layout.routes?.[idx % Math.max(layout.routes?.length || 1, 1)]
        const pts = route?.points || []
        if (!pts.length) {
          return { ...robot, status: 'IDLE' as RobotStatusCode }
        }
        const phase = (progress * robot.speedFactor + robot.phase) % 1
        const pos = pointOnRoute(pts, phase)
        let status: RobotStatusCode =
          playRef.current === 'idle' || playRef.current === 'paused' ? 'IDLE' : 'MOVING'

        if (playRef.current === 'running') {
          const nearCharge = (layout.charging_stations || []).some(
            (p) => dist2(pos.x, pos.y, p.x, p.y) < NEAR_RADIUS,
          )
          const nearLoad = (layout.load_unload_points || []).some(
            (p) => isLoadType(p.type) && dist2(pos.x, pos.y, p.x, p.y) < NEAR_RADIUS,
          )
          const nearUnload = (layout.load_unload_points || []).some(
            (p) => isUnloadType(p.type) && dist2(pos.x, pos.y, p.x, p.y) < NEAR_RADIUS,
          )
          if (nearCharge) status = 'CHARGING'
          else if (nearLoad) status = 'LOADING'
          else if (nearUnload) status = 'UNLOADING'
        }

        const prevDist = distanceAccRef.current[robot.id] || 0
        let completedDistance = robot.completedDistance
        if (playRef.current === 'running' && pos.dist >= prevDist) {
          completedDistance += (pos.dist - prevDist) * 0.01
        } else if (playRef.current === 'running' && pos.dist < prevDist) {
          // wrapped route
          completedDistance += ((pos.total - prevDist) + pos.dist) * 0.01
        }
        distanceAccRef.current[robot.id] = pos.dist

        let cargoKg = robot.cargoKg
        let battery = robot.battery
        let cycles = robot.cycles
        if (status === 'LOADING') cargoKg = Math.max(cargoKg, 200 + idx * 60)
        if (status === 'UNLOADING') cargoKg = 0
        if (status === 'CHARGING') battery = Math.min(100, battery + 0.02)
        else if (status === 'MOVING') battery = Math.max(12, battery - 0.004)

        const prev = lastStatusRef.current[robot.id]
        if (prev !== status) {
          if (status === 'MOVING' && (!prev || prev === 'IDLE')) {
            pushEvent(`${robot.label} → Движение по маршруту`, robot.id)
          } else if (status === 'LOADING') {
            pushEvent(`${robot.label} → Начата погрузка`, robot.id)
          } else if (status === 'UNLOADING') {
            pushEvent(`${robot.label} → Разгрузка`, robot.id)
          } else if (status === 'CHARGING') {
            pushEvent(`${robot.label} → На зарядке`, robot.id)
          }
          lastStatusRef.current[robot.id] = status
        }

        const nearStart = pos.dist < 8
        if (nearStart && !cycleLatchRef.current[robot.id] && playRef.current === 'running') {
          cycleLatchRef.current[robot.id] = true
          if (startedLatchRef.current) {
            cycles += 1
            pushEvent(`${robot.label} → Цикл завершён`, robot.id)
            const task = tasksRef.current.find((tk) => tk.id === robot.taskId)
            if (task) {
              task.status = 'COMPLETED'
              task.completedAt = Date.now()
              const nextId = `TASK-${String(tasksRef.current.length + 1).padStart(3, '0')}`
              const racks = storageNames(layout)
              const nextTask: SimTask = {
                id: nextId,
                status: 'ASSIGNED',
                robotId: robot.id,
                source: racks[idx % Math.max(racks.length, 1)] || 'Стеллаж C1',
                destination: 'Зона отгрузки',
                cargoWeight: 200 + idx * 60,
                createdAt: Date.now(),
                startedAt: Date.now(),
                completedAt: null,
              }
              tasksRef.current = [nextTask, ...tasksRef.current].slice(0, 12)
              robot.taskId = nextId
            }
          }
        } else if (pos.dist > 30) {
          cycleLatchRef.current[robot.id] = false
          startedLatchRef.current = true
        }

        // sync task status from robot status
        const task = tasksRef.current.find((tk) => tk.id === robot.taskId)
        if (task && task.status !== 'COMPLETED') {
          if (status === 'LOADING') task.status = 'LOADING'
          else if (status === 'UNLOADING') task.status = 'UNLOADING'
          else if (status === 'MOVING' && cargoKg > 0) task.status = 'MOVING_TO_DESTINATION'
          else if (status === 'MOVING') task.status = 'MOVING_TO_PICKUP'
          if (!task.startedAt && playRef.current === 'running') task.startedAt = Date.now()
        }

        return {
          ...robot,
          x: pos.x,
          y: pos.y,
          heading: pos.heading,
          status,
          cargoKg,
          battery: Math.round(battery * 10) / 10,
          completedDistance,
          cycles,
          taskId: robot.taskId,
        }
      })

      robotsStateRef.current = nextRobots

      const collisions = []
      for (let i = 0; i < nextRobots.length; i++) {
        for (let j = i + 1; j < nextRobots.length; j++) {
          const a = nextRobots[i]
          const b = nextRobots[j]
          if (dist2(a.x, a.y, b.x, b.y) < COLLISION_RADIUS) {
            collisions.push({
              a: a.id,
              b: b.id,
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2,
            })
          }
        }
      }

      if (t - lastKpiTs.current >= KPI_THROTTLE_MS || playRef.current !== 'running') {
        lastKpiTs.current = t
        const activeRobots = nextRobots.filter((r) => r.status !== 'IDLE').length
        const cycles = nextRobots.reduce((s, r) => s + r.cycles, 0)
        const distance = nextRobots.reduce((s, r) => s + r.completedDistance, 0)
        const completedTasks = tasksRef.current.filter((tk) => tk.status === 'COMPLETED').length
        const avgSpeed =
          nextRobots.length > 0
            ? nextRobots.reduce((s, r) => s + r.speedFactor * 1.2, 0) / nextRobots.length
            : 0
        setSnapshot({
          play: playRef.current,
          speed: speedRef.current,
          progress: progressRef.current,
          robots: nextRobots,
          tasks: [...tasksRef.current],
          events: [...eventsRef.current],
          collisions,
          kpi: {
            distance,
            cycles,
            completedTasks,
            activeRobots,
            avgSpeed,
            activityPct:
              nextRobots.length > 0
                ? Math.round((activeRobots / nextRobots.length) * 100)
                : 0,
          },
          robotsCapped,
          totalRobots,
          visibleRobots,
        })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [layout, pushEvent, robotsCapped, totalRobots, visibleRobots])

  const start = useCallback(() => {
    if (!startedLatchRef.current && robotsStateRef.current.length > 0) {
      pushEvent('Симуляция запущена')
    }
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
    selectedRobot?.taskId != null
      ? snapshot.tasks.find((t) => t.id === selectedRobot.taskId) || null
      : null

  return {
    snapshot,
    layers,
    toggleLayer,
    setLayers,
    selectedRobotId,
    setSelectedRobotId,
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
  }
}

function emptySnapshot(): SimulationSnapshot {
  return {
    play: 'idle',
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
    robotsCapped: false,
    totalRobots: 0,
    visibleRobots: 0,
  }
}

export type WarehouseSimulation = ReturnType<typeof useWarehouseSimulation>
