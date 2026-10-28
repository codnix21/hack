/**
 * Чистая математика Spatial Studio: snap, clamp, commit move/rotate.
 * Не трогает Three.js — только метры WarehouseLayout.
 */
import type { LayoutObject, WarehouseLayout } from '../../types'
import { objectCenterFromScene } from '../../utils/sceneCoords'

export function snapMeter(value: number, step: number): number {
  if (!(step > 0) || !Number.isFinite(value)) return value
  return Math.round(value / step) * step
}

/** Нормализация угла в (−180, 180] с округлением до decimals. */
export function normalizeRotationDeg(deg: number, decimals = 1): number {
  if (!Number.isFinite(deg)) return 0
  let d = deg % 360
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  const f = 10 ** decimals
  const out = Math.round(d * f) / f
  return Object.is(out, -0) ? 0 : out
}

export function clampObjectToRoom(
  layout: Pick<WarehouseLayout, 'width_m' | 'length_m'>,
  o: Pick<LayoutObject, 'x' | 'y' | 'width' | 'height'>,
): { x: number; y: number } {
  const maxX = Math.max(0, layout.width_m - o.width)
  const maxY = Math.max(0, layout.length_m - o.height)
  return {
    x: Math.min(maxX, Math.max(0, o.x)),
    y: Math.min(maxY, Math.max(0, o.y)),
  }
}

/**
 * Привязка угла объекта (левый верх AABB) к сетке.
 * Не меняет width/height. Не вызывается автоматически при включении snap.
 */
export function snapObjectPosition(
  x: number,
  y: number,
  step: number,
  enabled: boolean,
): { x: number; y: number } {
  if (!enabled || !(step > 0)) return { x, y }
  return { x: snapMeter(x, step), y: snapMeter(y, step) }
}

export function snapRotationDeg(deg: number, stepDeg: number, enabled: boolean): number {
  const n = normalizeRotationDeg(deg)
  if (!enabled || !(stepDeg > 0)) return n
  return normalizeRotationDeg(snapMeter(n, stepDeg))
}

/** Three.js group Y-rotation (рад) → угол плана (°), как в DTO. */
export function planRotationFromSceneY(rotationY: number): number {
  return normalizeRotationDeg((-rotationY * 180) / Math.PI)
}

export interface TransformCommitOpts {
  snapEnabled: boolean
  gridStepM: number
  rotationStepDeg: number
}

/**
 * Фиксация перемещения: scene center → plan x/y + snap + clamp.
 * Высота сцены игнорируется (пол Y=0).
 */
export function commitMoveFromScene(
  layout: Pick<WarehouseLayout, 'width_m' | 'length_m'>,
  o: LayoutObject,
  centerX: number,
  centerZ: number,
  opts: TransformCommitOpts,
): { x: number; y: number } {
  let { x, y } = objectCenterFromScene(layout, centerX, centerZ, o.width, o.height)
  ;({ x, y } = snapObjectPosition(x, y, opts.gridStepM, opts.snapEnabled))
  return clampObjectToRoom(layout, { ...o, x, y })
}

export function commitRotateFromSceneY(
  rotationY: number,
  opts: TransformCommitOpts,
): number {
  return snapRotationDeg(planRotationFromSceneY(rotationY), opts.rotationStepDeg, opts.snapEnabled)
}

/** Многократный round-trip без накопления (проверка стабильности). */
export function roundTripStable(
  layout: Pick<WarehouseLayout, 'width_m' | 'length_m'>,
  o: LayoutObject,
  times: number,
  opts: TransformCommitOpts,
): LayoutObject {
  let cur = { ...o }
  for (let i = 0; i < times; i++) {
    const cx = cur.x + cur.width / 2 - layout.width_m / 2
    const cz = cur.y + cur.height / 2 - layout.length_m / 2
    const pos = commitMoveFromScene(layout, cur, cx, cz, { ...opts, snapEnabled: false })
    const rotY = -((cur.rotation || 0) * Math.PI) / 180
    const rotation = commitRotateFromSceneY(rotY, { ...opts, snapEnabled: false })
    cur = { ...cur, ...pos, rotation }
  }
  return cur
}
