import { describe, expect, it } from 'vitest'
import type { LayoutObject, WarehouseLayout } from '../../types'
import {
  clampObjectToRoom,
  commitMoveFromScene,
  commitRotateFromSceneY,
  normalizeRotationDeg,
  planRotationFromSceneY,
  roundTripStable,
  snapMeter,
  snapObjectPosition,
  snapRotationDeg,
} from './spatialMath'
import { warehouseMetersToScene } from '../../utils/sceneCoords'

const room: Pick<WarehouseLayout, 'width_m' | 'length_m'> = { width_m: 40, length_m: 30 }

function obj(partial: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 'rack_1',
    kind: 'rack',
    name: 'Rack',
    x: 10,
    y: 8,
    width: 4,
    height: 2,
    rotation: 0,
    ...partial,
  }
}

describe('spatialMath snap', () => {
  it('snaps meters to step', () => {
    expect(snapMeter(1.24, 0.5)).toBeCloseTo(1.0, 5)
    expect(snapMeter(1.26, 0.5)).toBeCloseTo(1.5, 5)
  })

  it('does not mutate when snap disabled', () => {
    expect(snapObjectPosition(1.24, 3.7, 0.5, false)).toEqual({ x: 1.24, y: 3.7 })
  })

  it('snaps object corner when enabled', () => {
    expect(snapObjectPosition(1.24, 3.7, 0.5, true)).toEqual({ x: 1.0, y: 3.5 })
  })

  it('snaps rotation degrees', () => {
    expect(snapRotationDeg(14, 15, true)).toBe(15)
    expect(snapRotationDeg(14, 15, false)).toBe(14)
  })
})

describe('spatialMath clamp / rotate', () => {
  it('clamps to room keeping size', () => {
    expect(clampObjectToRoom(room, { x: -2, y: 100, width: 4, height: 2 })).toEqual({
      x: 0,
      y: 28,
    })
  })

  it('normalizes rotation to (−180, 180]', () => {
    expect(normalizeRotationDeg(190)).toBe(-170)
    expect(normalizeRotationDeg(-190)).toBe(170)
  })

  it('maps scene Y rotation to plan degrees', () => {
    expect(planRotationFromSceneY(-Math.PI / 2)).toBe(90)
    expect(planRotationFromSceneY(0)).toBe(0)
  })
})

describe('spatialMath commit move/rotate', () => {
  const opts = { snapEnabled: false, gridStepM: 0.5, rotationStepDeg: 15 }

  it('round-trips center without drift', () => {
    const o = obj({ x: 10, y: 8, width: 4, height: 2, rotation: 37.5 })
    const center = warehouseMetersToScene(room as WarehouseLayout, o.x + o.width / 2, o.y + o.height / 2)
    const pos = commitMoveFromScene(room, o, center.x, center.z, opts)
    expect(pos.x).toBeCloseTo(o.x, 5)
    expect(pos.y).toBeCloseTo(o.y, 5)
    const rotY = -((o.rotation || 0) * Math.PI) / 180
    expect(commitRotateFromSceneY(rotY, opts)).toBeCloseTo(37.5, 5)
  })

  it('applies grid snap on move commit without changing size', () => {
    const o = obj({ x: 10.12, y: 8.37, width: 4, height: 2 })
    const center = warehouseMetersToScene(
      room as WarehouseLayout,
      o.x + o.width / 2,
      o.y + o.height / 2,
    )
    const pos = commitMoveFromScene(room, o, center.x, center.z, {
      ...opts,
      snapEnabled: true,
      gridStepM: 0.5,
    })
    expect(pos.x).toBeCloseTo(10.0, 5)
    expect(pos.y).toBeCloseTo(8.5, 5)
  })

  it('clamps near room boundary after move', () => {
    const o = obj({ x: 38, y: 28, width: 4, height: 2 })
    // drag center far outside
    const pos = commitMoveFromScene(room, o, 100, 100, opts)
    expect(pos.x).toBe(36) // 40 - 4
    expect(pos.y).toBe(28) // 30 - 2
  })

  it('snaps rotation on commit', () => {
    const rotY = -((22 * Math.PI) / 180)
    expect(
      commitRotateFromSceneY(rotY, { snapEnabled: true, gridStepM: 0.5, rotationStepDeg: 15 }),
    ).toBe(15)
  })

  it('preserves size and does not accumulate error over many round-trips', () => {
    const o = obj({ x: 7.3, y: 11.1, width: 5, height: 3, rotation: -42 })
    const after = roundTripStable(room, o, 25, opts)
    expect(after.x).toBeCloseTo(o.x, 5)
    expect(after.y).toBeCloseTo(o.y, 5)
    expect(after.width).toBe(o.width)
    expect(after.height).toBe(o.height)
    expect(after.rotation).toBeCloseTo(o.rotation!, 5)
  })

  it('handles rotated object move via AABB center', () => {
    const o = obj({ x: 12, y: 9, width: 6, height: 2, rotation: 45 })
    const center = warehouseMetersToScene(room as WarehouseLayout, o.x + o.width / 2, o.y + o.height / 2)
    // nudge +1m in plan X via scene
    const pos = commitMoveFromScene(room, o, center.x + 1, center.z, opts)
    expect(pos.x).toBeCloseTo(13, 5)
    expect(pos.y).toBeCloseTo(9, 5)
    expect(o.width).toBe(6)
    expect(o.height).toBe(2)
  })
})
