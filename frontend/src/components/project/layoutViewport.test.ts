import { describe, expect, it } from 'vitest'
import {
  adaptiveGridStepM,
  fitViewport,
  scaleBarMeters,
  screenToWorld,
  snapValue,
  worldToScreen,
  zoomAtPoint,
} from './layoutViewport'

describe('layoutViewport', () => {
  it('round-trips world ↔ screen', () => {
    const vp = { zoom: 10, panX: 40, panY: 20 }
    const s = worldToScreen(12, 8, vp)
    expect(s.x).toBe(160)
    expect(s.y).toBe(100)
    const w = screenToWorld(s.x, s.y, vp)
    expect(w.x).toBeCloseTo(12, 8)
    expect(w.y).toBeCloseTo(8, 8)
  })

  it('fit keeps warehouse inside canvas', () => {
    const vp = fitViewport(100, 80, 800, 600, 40)
    const br = worldToScreen(100, 80, vp)
    expect(br.x).toBeLessThanOrEqual(800)
    expect(br.y).toBeLessThanOrEqual(600)
    expect(vp.zoom).toBeGreaterThan(0)
  })

  it('zoomAtPoint keeps world point under cursor', () => {
    const vp = { zoom: 8, panX: 50, panY: 30 }
    const sx = 200
    const sy = 150
    const before = screenToWorld(sx, sy, vp)
    const next = zoomAtPoint(vp, sx, sy, 2)
    const after = screenToWorld(sx, sy, next)
    expect(after.x).toBeCloseTo(before.x, 5)
    expect(after.y).toBeCloseTo(before.y, 5)
    expect(next.zoom).toBe(16)
  })

  it('snap and adaptive grid', () => {
    expect(snapValue(3.4, 1, true)).toBe(3)
    expect(snapValue(3.4, 1, false)).toBe(3.4)
    expect(adaptiveGridStepM(50)).toBeLessThanOrEqual(2)
    expect(scaleBarMeters(10)).toBeGreaterThan(0)
  })
})
