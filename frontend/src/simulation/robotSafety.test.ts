import { describe, expect, it } from 'vitest'
import {
  applySafetyStep,
  CONFLICT_RADIUS_PX,
  distanceWithinSpeedBudget,
  MAX_WAIT_SEC,
  type SafetyRobot,
} from './robotSafety'

function bot(partial: Partial<SafetyRobot> & { id: string }): SafetyRobot {
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
      { x: 200, y: 0 },
    ],
    ...partial,
  }
}

describe('robotSafety', () => {
  it('lower id advances; higher id waits on head-on conflict', () => {
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
    const r1 = applySafetyStep({
      robots: [a, b],
      dtSec: 0.1,
      simSpeed: 1,
      metersToPx: 10,
    })
    const ra = r1.robots.find((x) => x.id === 'robot_a')!
    const rb = r1.robots.find((x) => x.id === 'robot_b')!
    expect(ra.status).toBe('MOVING')
    expect(ra.routeDistPx).toBeGreaterThan(0)
    expect(rb.status).toBe('WAITING')
    expect(rb.routeDistPx).toBe(0)
    expect(rb.completedDistance).toBe(0)
  })

  it('waiting does not accumulate distance', () => {
    const a = bot({ id: 'a', x: 0, y: 0 })
    const b = bot({ id: 'b', x: 10, y: 0, waitSec: 0 })
    let state = [a, b]
    for (let i = 0; i < 5; i++) {
      const step = applySafetyStep({
        robots: state,
        dtSec: 0.2,
        simSpeed: 1,
        metersToPx: 10,
        conflictRadiusPx: 40,
      })
      state = step.robots
    }
    const waiter = state.find((x) => x.id === 'b')!
    expect(waiter.status === 'WAITING' || waiter.status === 'BLOCKED').toBe(true)
    expect(waiter.completedDistance).toBe(0)
  })

  it('timeout marks BLOCKED after max wait', () => {
    const a = bot({ id: 'a', x: 0, y: 0 })
    const b = bot({ id: 'b', x: 8, y: 0, waitSec: MAX_WAIT_SEC - 0.05 })
    const step = applySafetyStep({
      robots: [a, b],
      dtSec: 0.1,
      simSpeed: 1,
      metersToPx: 10,
      conflictRadiusPx: 40,
      maxWaitSec: MAX_WAIT_SEC,
    })
    expect(step.robots.find((x) => x.id === 'b')!.status).toBe('BLOCKED')
  })

  it('same inputs are deterministic', () => {
    const robots = [
      bot({ id: 'r1', x: 0, y: 0 }),
      bot({ id: 'r2', x: 5, y: 0 }),
    ]
    const a = applySafetyStep({ robots, dtSec: 0.05, simSpeed: 1, metersToPx: 8 })
    const b = applySafetyStep({ robots, dtSec: 0.05, simSpeed: 1, metersToPx: 8 })
    expect(a.robots.map((r) => [r.x, r.y, r.status, r.routeDistPx])).toEqual(
      b.robots.map((r) => [r.x, r.y, r.status, r.routeDistPx]),
    )
  })

  it('distanceWithinSpeedBudget holds for DES estimate', () => {
    expect(distanceWithinSpeedBudget(1.2, 1, 1.2)).toBe(true)
    expect(distanceWithinSpeedBudget(2.5, 1, 1.2)).toBe(false)
  })

  it('pause-equivalent dt=0 does not move', () => {
    const r = bot({ id: 'r1', x: 10, y: 10, routeDistPx: 5 })
    const step = applySafetyStep({
      robots: [r],
      dtSec: 0,
      simSpeed: 1,
      metersToPx: 10,
    })
    expect(step.robots[0].routeDistPx).toBe(5)
    expect(step.robots[0].x).toBe(10)
    expect(step.robots[0].y).toBe(10)
  })
})
