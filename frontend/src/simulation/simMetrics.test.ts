import { describe, expect, it } from 'vitest'
import {
  computeSimMetrics,
  deriveSimPhase,
  displayRouteLengthM,
  isExecutableRoute,
} from './simMetrics'
import type { SimRobot, SimTask } from './types'

function task(partial: Partial<SimTask> & { id: string }): SimTask {
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
      { x: 10, y: 0 },
    ],
    lengthM: 10,
    executableLengthM: 10,
    blocked: false,
    ...partial,
  }
}

function robot(partial: Partial<SimRobot> & { id: string }): SimRobot {
  return {
    label: partial.id,
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
    ...partial,
  }
}

describe('simMetrics contract', () => {
  it('completed and blocked are not active', () => {
    const tasks = [
      task({ id: 't1', status: 'COMPLETED' }),
      task({ id: 't2', status: 'BLOCKED', blocked: true, routePoints: [], lengthM: 0 }),
      task({ id: 't3', status: 'NAVIGATING', robotId: 'r1' }),
      task({ id: 't4', status: 'WAITING', robotId: 'r2' }),
    ]
    const m = computeSimMetrics({
      play: 'running',
      robots: [
        robot({ id: 'r1', status: 'MOVING', taskId: 't3', completedDistance: 3 }),
        robot({ id: 'r2', status: 'WAITING', taskId: 't4', completedDistance: 1 }),
      ],
      tasks,
      configuredRobots: 10,
      visibleRobots: 2,
      robotsCapped: true,
    })
    expect(m.activeTasks).toBe(2)
    expect(m.blockedTasks).toBe(1)
    expect(m.completedTasks).toBe(1)
    expect(m.acceptedDistanceMeters).toBe(4)
    expect(m.movingRobots).toBe(1)
    expect(m.waitingRobots).toBe(1)
  })

  it('blocked task has no display length', () => {
    const t = task({
      id: 'b',
      status: 'BLOCKED',
      blocked: true,
      lengthM: 0,
      plannedLengthM: 42,
      routePoints: [],
    })
    expect(displayRouteLengthM(t)).toBeNull()
    expect(isExecutableRoute(t)).toBe(false)
  })

  it('stalled when running but no progress possible', () => {
    const phase = deriveSimPhase({
      play: 'running',
      tasks: [
        task({ id: 'a', status: 'BLOCKED', blocked: true, routePoints: [] }),
        task({ id: 'b', status: 'COMPLETED', routePoints: [] }),
      ],
      robots: [robot({ id: 'r1', status: 'IDLE' })],
    })
    expect(phase).toBe('completed')
  })

  it('stalled when assigned without executable route', () => {
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

  it('mixed active waiting completed blocked', () => {
    const m = computeSimMetrics({
      play: 'running',
      robots: [
        robot({ id: 'r1', status: 'MOVING', taskId: 't1', completedDistance: 5 }),
        robot({ id: 'r2', status: 'WAITING', taskId: 't2', completedDistance: 2 }),
        robot({ id: 'r3', status: 'BLOCKED', completedDistance: 1 }),
        robot({ id: 'r4', status: 'IDLE', completedDistance: 0 }),
      ],
      tasks: [
        task({ id: 't1', status: 'NAVIGATING', robotId: 'r1' }),
        task({ id: 't2', status: 'WAITING', robotId: 'r2' }),
        task({ id: 't3', status: 'COMPLETED' }),
        task({ id: 't4', status: 'BLOCKED', blocked: true, routePoints: [] }),
        task({ id: 't5', status: 'QUEUED' }),
      ],
      configuredRobots: 20,
      visibleRobots: 4,
      robotsCapped: true,
    })
    expect(m.activeTasks).toBe(2)
    expect(m.blockedTasks).toBe(1)
    expect(m.completedTasks).toBe(1)
    expect(m.queuedTasks).toBe(1)
    expect(m.unassignedTasks).toBe(1)
    expect(m.phase).toBe('running')
    expect(m.acceptedDistanceMeters).toBe(8)
  })

  it('panels share one metrics object fields', () => {
    const m = computeSimMetrics({
      play: 'paused',
      robots: [robot({ id: 'r1', status: 'MOVING', completedDistance: 12.5 })],
      tasks: [task({ id: 't1', status: 'NAVIGATING', robotId: 'r1' })],
      configuredRobots: 186,
      visibleRobots: 6,
      robotsCapped: true,
    })
    expect(m.configuredRobots).toBe(186)
    expect(m.visibleRobots).toBe(6)
    expect(m.phase).toBe('paused')
    expect(m.acceptedDistanceMeters).toBe(12.5)
  })
})
