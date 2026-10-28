import { describe, expect, it } from 'vitest'
import type { VisualizationLayout, WarehouseLayout } from '../types'
import {
  LAYOUT_PAD_PX,
  fitCameraPosition,
  metersToScene,
  vizExtentsM,
  vizPxToMeters,
  vizPxToScene,
  vizRectToSceneBox,
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
})
