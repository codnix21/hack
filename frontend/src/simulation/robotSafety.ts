/**
 * Минимальная детерминированная безопасность мульти-роботов (DES-демо).
 * Не industrial traffic manager: приоритет по lexicographic id, ожидание с таймаутом.
 */

import { pointAlongPolyline } from './pathMath'

export const DEMO_ROBOT_RADIUS_PX = 14
export const CONFLICT_RADIUS_PX = DEMO_ROBOT_RADIUS_PX * 2
export const MAX_WAIT_SEC = 8

export interface SafetyRobot {
  id: string
  x: number
  y: number
  routeDistPx: number
  status: string
  waitSec: number
  completedDistance: number
  speedMps: number
  speedFactor: number
  routePoints: { x: number; y: number }[]
  taskBlocked?: boolean
  /** id оппонента при WAITING/BLOCKED по конфликту */
  conflictWith?: string | null
}

export interface StepInput {
  robots: SafetyRobot[]
  dtSec: number
  simSpeed: number
  metersToPx: number
  conflictRadiusPx?: number
  maxWaitSec?: number
}

export interface StepResult {
  robots: SafetyRobot[]
  collisions: { a: string; b: string; x: number; y: number }[]
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by)
}

function cloneRobot(r: SafetyRobot): SafetyRobot {
  return { ...r, routePoints: r.routePoints }
}

/** Предлагаемая позиция без учёта других роботов. */
export function proposeMove(r: SafetyRobot, dtSec: number, simSpeed: number, metersToPx: number) {
  if (dtSec <= 0 || simSpeed <= 0) {
    return {
      x: r.x,
      y: r.y,
      routeDistPx: r.routeDistPx,
      completedDistance: r.completedDistance,
      status: r.status,
      moved: false,
      done: false,
    }
  }
  if (r.taskBlocked || r.status === 'BLOCKED' || !r.routePoints.length) {
    return {
      x: r.x,
      y: r.y,
      routeDistPx: r.routeDistPx,
      completedDistance: r.completedDistance,
      status: r.taskBlocked || r.status === 'BLOCKED' ? 'BLOCKED' : 'IDLE',
      moved: false,
      done: false,
    }
  }
  const speedPx = r.speedMps * metersToPx * r.speedFactor * simSpeed
  const nextDist = r.routeDistPx + dtSec * speedPx
  const pos = pointAlongPolyline(r.routePoints, nextDist)
  const distM = dtSec * r.speedMps * r.speedFactor * simSpeed
  return {
    x: pos.x,
    y: pos.y,
    routeDistPx: nextDist,
    completedDistance: r.completedDistance + distM,
    status: pos.done ? 'IDLE' : 'MOVING',
    moved: true,
    done: pos.done,
  }
}

/**
 * Применяет шаг: меньший id (localeCompare) имеет приоритет проезда.
 * Конфликтующий робот остаётся на месте (WAITING); при waitSec ≥ max — BLOCKED.
 */
export function applySafetyStep(input: StepInput): StepResult {
  const radius = input.conflictRadiusPx ?? CONFLICT_RADIUS_PX
  const maxWait = input.maxWaitSec ?? MAX_WAIT_SEC
  const order = [...input.robots].sort((a, b) => a.id.localeCompare(b.id))
  const accepted: SafetyRobot[] = []
  const collisions: StepResult['collisions'] = []

  for (const orig of order) {
    const prop = proposeMove(orig, input.dtSec, input.simSpeed, input.metersToPx)

    if (!prop.moved) {
      accepted.push({
        ...cloneRobot(orig),
        status: prop.status,
        waitSec: 0,
        conflictWith: null,
      })
      continue
    }

    let hit: SafetyRobot | null = null
    for (const a of accepted) {
      if (a.status === 'BLOCKED') continue
      // IDLE тоже занимает точку (стоит у цели)
      if (dist(prop.x, prop.y, a.x, a.y) < radius) {
        hit = a
        break
      }
    }

    if (hit) {
      const waitSec = orig.waitSec + input.dtSec * input.simSpeed
      collisions.push({
        a: orig.id,
        b: hit.id,
        x: (orig.x + hit.x) / 2,
        y: (orig.y + hit.y) / 2,
      })
      if (waitSec >= maxWait) {
        accepted.push({
          ...cloneRobot(orig),
          status: 'BLOCKED',
          waitSec,
          conflictWith: hit.id,
          // позиция и completedDistance без движения
        })
      } else {
        accepted.push({
          ...cloneRobot(orig),
          status: 'WAITING',
          waitSec,
          conflictWith: hit.id,
        })
      }
    } else {
      accepted.push({
        ...cloneRobot(orig),
        x: prop.x,
        y: prop.y,
        routeDistPx: prop.routeDistPx,
        completedDistance: prop.completedDistance,
        status: prop.status,
        waitSec: 0,
        conflictWith: null,
      })
    }
  }

  const byId = new Map(accepted.map((r) => [r.id, r]))
  return {
    robots: input.robots.map((r) => byId.get(r.id) || r),
    collisions,
  }
}

/** Оценка: путь не длиннее v*t + epsilon (для проверки DES). */
export function distanceWithinSpeedBudget(
  distanceM: number,
  elapsedSec: number,
  speedMps: number,
  epsilon = 0.05,
) {
  if (elapsedSec < 0) return false
  return distanceM <= speedMps * elapsedSec + epsilon
}
