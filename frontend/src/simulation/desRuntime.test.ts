/**
 * Приёмочные сценарии DES runtime (без React).
 */
import { describe, expect, it } from 'vitest'
import { applySafetyStep, CONFLICT_RADIUS_PX, MAX_WAIT_SEC, type SafetyRobot } from './robotSafety'
import {
  computeSimMetrics,
  deriveSimPhase,
  displayRouteLengthM,
  isExecutableRoute,
} from './simMetrics'
import type { SimRobot, SimTask } from './types'

function bot(p: Partial<SafetyRobot> & { id: string }): SafetyRobot {
  return {
    x: 0,
    y: 0,
    routeDistPx: 0,
    status: 'IDLE',
    waitSec: 0,
    completedDistance: 0,
    speedMps: 1.2,
    speedFactor: 1,
    routePoints: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ],
    ...p,
  }
}

function task(p: Partial<SimTask> & { id: string }): SimTask {
  return {
    status: 'QUEUED',
    robotId: null,
    source: 'A',
    destination: 'B',
    cargoWeight: 0,
    createdAt: 0,
    startedAt: null,
    completedAt: null,
    routePoints: [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ],
    lengthM: 50,
    executableLengthM: 50,
    blocked: false,
    ...p,
  }
}

function robot(p: Partial<SimRobot> & { id: string }): SimRobot {
  return {
    label: p.id,
    type: 'AMR',
    x: 0,
    y: 0,
    heading: 0,
    speedFactor: 1,
    speedMps: 1.2,
    status: 'IDLE',
    battery: 90,
    cargoKg: 0,
    routeId: '',
    taskId: null,
    routeDistPx: 0,
    completedDistance: 0,
    cycles: 0,
    phase: 0,
    waitSec: 0,
    ...p,
  }
}

describe('DES acceptance scenarios', () => {
  it('1. all tasks completed → phase completed', () => {
    const phase = deriveSimPhase({
      play: 'running',
      tasks: [task({ id: 'a', status: 'COMPLETED' }), task({ id: 'b', status: 'COMPLETED' })],
      robots: [robot({ id: 'r1', status: 'IDLE' })],
    })
    expect(phase).toBe('completed')
  })

  it('2. all routes blocked → phase completed (terminal)', () => {
    const tasks = [
      task({ id: 'a', status: 'BLOCKED', blocked: true, routePoints: [], lengthM: 0 }),
      task({ id: 'b', status: 'BLOCKED', blocked: true, routePoints: [], lengthM: 0 }),
    ]
    expect(deriveSimPhase({ play: 'running', tasks, robots: [] })).toBe('completed')
    expect(tasks.every((t) => !isExecutableRoute(t))).toBe(true)
  })

  it('3. mixed active waiting completed blocked', () => {
    const m = computeSimMetrics({
      play: 'running',
      robots: [
        robot({ id: 'r1', status: 'MOVING', taskId: 't1', completedDistance: 1 }),
        robot({ id: 'r2', status: 'WAITING', taskId: 't2', completedDistance: 0 }),
      ],
      tasks: [
        task({ id: 't1', status: 'NAVIGATING', robotId: 'r1' }),
        task({ id: 't2', status: 'WAITING', robotId: 'r2' }),
        task({ id: 't3', status: 'COMPLETED' }),
        task({ id: 't4', status: 'BLOCKED', blocked: true, routePoints: [], lengthM: 0 }),
      ],
      configuredRobots: 6,
      visibleRobots: 2,
      robotsCapped: false,
    })
    expect(m.activeTasks).toBe(2)
    expect(m.blockedTasks).toBe(1)
    expect(m.completedTasks).toBe(1)
  })

  it('4. blocked task length not displayed', () => {
    const t = task({
      id: 'x',
      status: 'BLOCKED',
      blocked: true,
      lengthM: 0,
      plannedLengthM: 99,
      routePoints: [],
    })
    expect(displayRouteLengthM(t)).toBeNull()
  })

  it('5. reassignment after block: pick only executable queued', () => {
    const tasks = [
      task({ id: 'dead', status: 'BLOCKED', blocked: true, routePoints: [], robotId: null }),
      task({ id: 'next', status: 'QUEUED', robotId: null }),
    ]
    const next = tasks.find((tk) => tk.status === 'QUEUED' && isExecutableRoute(tk))
    expect(next?.id).toBe('next')
  })

  it('6. reset-equivalent: zero distance and ready phase', () => {
    const m = computeSimMetrics({
      play: 'idle',
      robots: [robot({ id: 'r1', completedDistance: 0, status: 'IDLE' })],
      tasks: [task({ id: 't1', status: 'ASSIGNED', robotId: 'r1' })],
      configuredRobots: 3,
      visibleRobots: 3,
      robotsCapped: false,
    })
    expect(m.phase).toBe('ready')
    expect(m.acceptedDistanceMeters).toBe(0)
  })

  it('7. pause with nonzero progress keeps distance', () => {
    const m = computeSimMetrics({
      play: 'paused',
      robots: [robot({ id: 'r1', status: 'MOVING', completedDistance: 17.5, taskId: 't1' })],
      tasks: [task({ id: 't1', status: 'NAVIGATING', robotId: 'r1' })],
      configuredRobots: 3,
      visibleRobots: 1,
      robotsCapped: false,
    })
    expect(m.phase).toBe('paused')
    expect(m.acceptedDistanceMeters).toBe(17.5)
  })

  it('8. conflict: lower id moves, higher waits', () => {
    const a = bot({ id: 'robot_a', x: 0, y: 0 })
    const b = bot({
      id: 'robot_b',
      x: CONFLICT_RADIUS_PX - 2,
      y: 0,
      routePoints: [
        { x: CONFLICT_RADIUS_PX - 2, y: 0 },
        { x: -100, y: 0 },
      ],
    })
    const step = applySafetyStep({
      robots: [a, b],
      dtSec: 0.1,
      simSpeed: 1,
      metersToPx: 10,
    })
    expect(step.robots.find((r) => r.id === 'robot_a')!.status).toBe('MOVING')
    expect(step.robots.find((r) => r.id === 'robot_b')!.status).toBe('WAITING')
    expect(step.robots.find((r) => r.id === 'robot_b')!.conflictWith).toBe('robot_a')
  })

  it('9. WAITING does not move or accumulate distance', () => {
    const a = bot({ id: 'a', x: 0, y: 0 })
    const b = bot({ id: 'b', x: 10, y: 0 })
    let state = [a, b]
    for (let i = 0; i < 4; i++) {
      state = applySafetyStep({
        robots: state,
        dtSec: 0.2,
        simSpeed: 1,
        metersToPx: 10,
        conflictRadiusPx: 40,
      }).robots
    }
    const waiter = state.find((r) => r.id === 'b')!
    expect(waiter.status === 'WAITING' || waiter.status === 'BLOCKED').toBe(true)
    expect(waiter.completedDistance).toBe(0)
    expect(waiter.x).toBe(10)
  })

  it('10. accepted distance equals sum of robot completedDistance', () => {
    const robots = [
      robot({ id: 'r1', completedDistance: 10.2 }),
      robot({ id: 'r2', completedDistance: 5.3 }),
    ]
    const m = computeSimMetrics({
      play: 'running',
      robots,
      tasks: [],
      configuredRobots: 2,
      visibleRobots: 2,
      robotsCapped: false,
    })
    expect(m.acceptedDistanceMeters).toBeCloseTo(15.5, 5)
  })

  it('11. KPI fields consistent for strip and panel', () => {
    const m = computeSimMetrics({
      play: 'running',
      robots: [
        robot({ id: 'r1', status: 'MOVING', taskId: 't1', completedDistance: 3 }),
        robot({ id: 'r2', status: 'BLOCKED', completedDistance: 1 }),
      ],
      tasks: [
        task({ id: 't1', status: 'NAVIGATING', robotId: 'r1' }),
        task({ id: 't2', status: 'BLOCKED', blocked: true, routePoints: [], lengthM: 0 }),
        task({ id: 't3', status: 'COMPLETED' }),
      ],
      configuredRobots: 186,
      visibleRobots: 6,
      robotsCapped: true,
    })
    // strip uses active/blocked/completed; panel uses same metrics
    expect(m.activeTasks + m.blockedTasks + m.completedTasks + m.queuedTasks).toBe(3)
    expect(m.configuredRobots).not.toBe(m.visibleRobots)
  })

  it('12. layout invalidation: blocked / empty route not executable', () => {
    const stale = task({ id: 'old', status: 'ASSIGNED', routePoints: [], lengthM: 0, blocked: true })
    expect(isExecutableRoute(stale)).toBe(false)
  })

  it('13. stalled when assigned but no executable motion', () => {
    const phase = deriveSimPhase({
      play: 'running',
      tasks: [
        task({
          id: 'ghost',
          status: 'ASSIGNED',
          robotId: 'r1',
          routePoints: [],
          lengthM: 0,
        }),
      ],
      robots: [robot({ id: 'r1', status: 'IDLE', taskId: 'ghost' })],
    })
    expect(phase).toBe('stalled')
  })

  it('14. cannot execute without valid route', () => {
    const t = task({ id: 'bad', blocked: true, status: 'BLOCKED', routePoints: [], lengthM: 0 })
    expect(isExecutableRoute(t)).toBe(false)
    const step = applySafetyStep({
      robots: [bot({ id: 'r1', taskBlocked: true, routePoints: [] })],
      dtSec: 0.5,
      simSpeed: 1,
      metersToPx: 10,
    })
    expect(step.robots[0].completedDistance).toBe(0)
    expect(step.robots[0].status).toBe('BLOCKED')
  })

  it('15. deterministic conflict timeout with partner id', () => {
    const a = bot({ id: 'a', x: 0, y: 0 })
    const b = bot({ id: 'b', x: 8, y: 0, waitSec: MAX_WAIT_SEC - 0.05 })
    const s1 = applySafetyStep({
      robots: [a, b],
      dtSec: 0.1,
      simSpeed: 1,
      metersToPx: 10,
      conflictRadiusPx: 40,
      maxWaitSec: MAX_WAIT_SEC,
    })
    const s2 = applySafetyStep({
      robots: [a, b],
      dtSec: 0.1,
      simSpeed: 1,
      metersToPx: 10,
      conflictRadiusPx: 40,
      maxWaitSec: MAX_WAIT_SEC,
    })
    expect(s1.robots.find((r) => r.id === 'b')!.status).toBe('BLOCKED')
    expect(s1.robots.find((r) => r.id === 'b')!.conflictWith).toBe('a')
    expect(s1.robots.map((r) => r.status)).toEqual(s2.robots.map((r) => r.status))
  })
})
