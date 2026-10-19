import { describe, expect, it } from 'vitest'
import { pointAlongPolyline, polylineLength } from './pathMath'

describe('pathMath', () => {
  it('computes length and endpoint', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40 },
    ]
    expect(polylineLength(pts)).toBeCloseTo(70, 5)
    const mid = pointAlongPolyline(pts, 30)
    expect(mid.x).toBeCloseTo(30, 5)
    expect(mid.y).toBeCloseTo(0, 5)
    expect(mid.done).toBe(false)
    const end = pointAlongPolyline(pts, 70)
    expect(end.done).toBe(true)
    expect(end.y).toBeCloseTo(40, 5)
  })
})
