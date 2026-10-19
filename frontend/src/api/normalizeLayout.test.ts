import { describe, expect, it } from 'vitest'
import { normalizeLayout } from './economics'
import type { BackendLayout } from '../types'

describe('normalizeLayout', () => {
  it('preserves relative geometry of racks from saved layout meters', () => {
    const raw: BackendLayout = {
      canvas: { width_m: 100, length_m: 80, unit: 'm' },
      zones: [
        {
          id: 'rack_a',
          name: 'Стеллаж A',
          type: 'storage',
          x: 10,
          y: 20,
          width: 8,
          height: 16,
        },
        {
          id: 'load1',
          name: 'Приёмка',
          type: 'load',
          x: 2,
          y: 2,
          width: 4,
          height: 3,
        },
      ],
      routes: [{ id: 'route_1', name: 'R1', points: [{ x: 4, y: 3.5 }, { x: 50, y: 3.5 }], blocked: false }],
      robots: [{ id: 'robot_1', name: 'R1', x: 5, y: 70, route_id: 'route_1' }],
      charging_stations: [],
      load_unload_points: [],
      meta: { source: 'saved_layout', robots_count: 8 },
    }
    const viz = normalizeLayout(raw)
    const rack = viz.zones.find((z) => z.id === 'rack_a')!
    const load = viz.zones.find((z) => z.id === 'load1')!
    // same scale: Δx_m / Δw_m == Δx_px / Δw_px
    expect(rack.w / load.w).toBeCloseTo(8 / 4, 5)
    expect(rack.h / load.h).toBeCloseTo(16 / 3, 5)
    expect((rack.x - load.x) / load.w).toBeCloseTo((10 - 2) / 4, 5)
    expect(viz.robot_count).toBe(8)
    expect(viz.routes[0].blocked).toBe(false)
  })

  it('preserves blocked empty routes without inventing points', () => {
    const raw: BackendLayout = {
      canvas: { width_m: 40, length_m: 30, unit: 'm' },
      zones: [
        { id: 'rack1', name: 'R', type: 'storage', x: 10, y: 5, width: 10, height: 20 },
      ],
      routes: [{ id: 'route_1', name: 'нет пути', points: [], blocked: true }],
      robots: [],
      charging_stations: [],
      load_unload_points: [],
      meta: {
        source: 'saved_layout',
        robots_count: 186,
        rotation_supported: false,
        route_warnings: ['Маршрут 1: путь не найден'],
      },
    }
    const viz = normalizeLayout(raw)
    expect(viz.routes[0].blocked).toBe(true)
    expect(viz.routes[0].points).toEqual([])
    expect(viz.robot_count).toBe(186)
  })
})
