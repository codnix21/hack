import { describe, expect, it } from 'vitest'
import type { VisualizationLayout, WarehouseLayout } from '../types'
import {
  LAYOUT_PAD_PX,
  fitCameraPosition,
  isGlbMagic,
  metersToScene,
  scenePolylineLengthM,
  vizExtentsM,
  vizPxToMeters,
  vizPxToScene,
  vizRectToSceneBox,
  vizRouteToScenePoints,
  warehouseMetersToScene,
} from './sceneCoords'

function sampleViz(): VisualizationLayout {
  const widthM = 40
  const lengthM = 30
  const pad = LAYOUT_PAD_PX
  const scale = 10
  return {
    width: Math.round(widthM * scale + pad * 2),
    height: Math.round(lengthM * scale + pad * 2),
    metersToPx: scale,
    walls: [],
    zones: [],
    routes: [],
    robots: [],
    charging_stations: [],
    load_unload_points: [],
    robot_count: 0,
    raw: { canvas: { width_m: widthM, length_m: lengthM, unit: 'm' } },
  }
}

describe('sceneCoords', () => {
  it('reads extents from raw canvas meters', () => {
    const e = vizExtentsM(sampleViz())
    expect(e.widthM).toBe(40)
    expect(e.lengthM).toBe(30)
  })

  it('converts plan px to meters using pad and metersToPx', () => {
    const layout = sampleViz()
    const { xM, yM } = vizPxToMeters(layout, LAYOUT_PAD_PX + 50, LAYOUT_PAD_PX + 20)
    expect(xM).toBeCloseTo(5, 5)
    expect(yM).toBeCloseTo(2, 5)
  })

  it('centers warehouse at scene origin', () => {
    const s = metersToScene(20, 15, { widthM: 40, lengthM: 30 })
    expect(s.x).toBeCloseTo(0, 5)
    expect(s.z).toBeCloseTo(0, 5)
  })

  it('maps corner of plan to corner of floor', () => {
    const layout = sampleViz()
    const corner = vizPxToScene(layout, LAYOUT_PAD_PX, LAYOUT_PAD_PX)
    expect(corner.x).toBeCloseTo(-20, 5)
    expect(corner.z).toBeCloseTo(-15, 5)
  })

  it('preserves rectangle size in meters', () => {
    const layout = sampleViz()
    // 4m x 2m rack at (10, 8)
    const box = vizRectToSceneBox(
      layout,
      LAYOUT_PAD_PX + 10 * 10,
      LAYOUT_PAD_PX + 8 * 10,
      4 * 10,
      2 * 10,
    )
    expect(box.sx).toBeCloseTo(4, 5)
    expect(box.sz).toBeCloseTo(2, 5)
  })

  it('converts WarehouseLayout meters without pad', () => {
    const layout: WarehouseLayout = {
      unit: 'm',
      width_m: 50,
      length_m: 40,
      objects: [],
    }
    const s = warehouseMetersToScene(layout, 25, 20)
    expect(s.x).toBeCloseTo(0, 5)
    expect(s.z).toBeCloseTo(0, 5)
  })

  it('fit camera scales with warehouse size', () => {
    const small = fitCameraPosition({ widthM: 10, lengthM: 10 })
    const large = fitCameraPosition({ widthM: 80, lengthM: 80 })
    expect(large.position[1]).toBeGreaterThan(small.position[1])
  })

  it('handles empty layout extents via fallback', () => {
    const layout: VisualizationLayout = {
      width: LAYOUT_PAD_PX * 2 + 100,
      height: LAYOUT_PAD_PX * 2 + 50,
      metersToPx: 5,
      walls: [],
      zones: [],
      routes: [],
      robots: [],
      charging_stations: [],
      load_unload_points: [],
      robot_count: 0,
    }
    const e = vizExtentsM(layout)
    expect(e.widthM).toBeCloseTo(20, 5)
    expect(e.lengthM).toBeCloseTo(10, 5)
  })

  it('maps 10×20 warehouse corners and preserves distances', () => {
    const widthM = 10
    const lengthM = 20
    const scale = 8
    const layout: VisualizationLayout = {
      width: Math.round(widthM * scale + LAYOUT_PAD_PX * 2),
      height: Math.round(lengthM * scale + LAYOUT_PAD_PX * 2),
      metersToPx: scale,
      walls: [],
      zones: [],
      routes: [],
      robots: [],
      charging_stations: [],
      load_unload_points: [],
      robot_count: 0,
      raw: { canvas: { width_m: widthM, length_m: lengthM, unit: 'm' } },
    }
    const origin = vizPxToScene(layout, LAYOUT_PAD_PX, LAYOUT_PAD_PX)
    const far = vizPxToScene(layout, LAYOUT_PAD_PX + widthM * scale, LAYOUT_PAD_PX + lengthM * scale)
    expect(origin.x).toBeCloseTo(-5, 5)
    expect(origin.z).toBeCloseTo(-10, 5)
    expect(far.x).toBeCloseTo(5, 5)
    expect(far.z).toBeCloseTo(10, 5)
    const dx = far.x - origin.x
    const dz = far.z - origin.z
    expect(Math.hypot(dx, dz)).toBeCloseTo(Math.hypot(widthM, lengthM), 5)
  })

  it('does not invent route geometry for blocked or empty polylines', () => {
    const layout = sampleViz()
    expect(vizRouteToScenePoints(layout, { blocked: true, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] })).toEqual(
      [],
    )
    expect(vizRouteToScenePoints(layout, { points: [{ x: 20, y: 20 }] })).toEqual([])
  })

  it('preserves route point order and length in meters', () => {
    const layout = sampleViz()
    const scale = layout.metersToPx!
    const a = { x: LAYOUT_PAD_PX, y: LAYOUT_PAD_PX }
    const b = { x: LAYOUT_PAD_PX + 3 * scale, y: LAYOUT_PAD_PX }
    const c = { x: LAYOUT_PAD_PX + 3 * scale, y: LAYOUT_PAD_PX + 4 * scale }
    const pts = vizRouteToScenePoints(layout, { points: [a, b, c] })
    expect(pts).toHaveLength(3)
    expect(pts[0].x).toBeLessThan(pts[1].x)
    expect(pts[1].z).toBeLessThan(pts[2].z)
    expect(scenePolylineLengthM(pts)).toBeCloseTo(7, 5)
  })

  it('detects GLB magic and rejects HTML/SPA fallback payloads', () => {
    const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0, 0, 0, 0]).buffer
    const html = new TextEncoder().encode('<!doctype html>').buffer
    expect(isGlbMagic(glb)).toBe(true)
    expect(isGlbMagic(html)).toBe(false)
  })

  it('WarehouseLayout aspect ratio 60×20 stays metric in scene', () => {
    const layout: WarehouseLayout = { unit: 'm', width_m: 60, length_m: 20, objects: [] }
    const tl = warehouseMetersToScene(layout, 0, 0)
    const br = warehouseMetersToScene(layout, 60, 20)
    expect(Math.abs(br.x - tl.x)).toBeCloseTo(60, 5)
    expect(Math.abs(br.z - tl.z)).toBeCloseTo(20, 5)
  })
})
