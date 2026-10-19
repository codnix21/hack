/** Поли линия маршрута: позиция по пройденной длине (в тех же единицах, что точки). */

export function polylineLength(points: { x: number; y: number }[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return total
}

export function pointAlongPolyline(
  points: { x: number; y: number }[],
  dist: number,
): { x: number; y: number; heading: number; done: boolean; total: number } {
  if (!points.length) return { x: 0, y: 0, heading: 0, done: true, total: 0 }
  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y, heading: 0, done: true, total: 0 }
  }
  const total = polylineLength(points)
  if (total <= 1e-9) {
    return { x: points[0].x, y: points[0].y, heading: 0, done: true, total: 0 }
  }
  const clamped = Math.min(Math.max(dist, 0), total)
  let acc = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (acc + seg >= clamped || i === points.length - 1) {
      const t = seg > 1e-9 ? (clamped - acc) / seg : 0
      const heading = Math.atan2(b.y - a.y, b.x - a.x)
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        heading,
        done: clamped >= total - 1e-6,
        total,
      }
    }
    acc += seg
  }
  const last = points[points.length - 1]
  return { x: last.x, y: last.y, heading: 0, done: true, total }
}
