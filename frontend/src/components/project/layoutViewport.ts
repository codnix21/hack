/** Viewport планировщика: экран ↔ метры. Не меняет мировые координаты модели. */

export interface Viewport {
  /** пикселей на метр */
  zoom: number
  /** смещение экрана, px */
  panX: number
  panY: number
}

export function worldToScreen(vx: number, vy: number, vp: Viewport) {
  return { x: vp.panX + vx * vp.zoom, y: vp.panY + vy * vp.zoom }
}

export function screenToWorld(sx: number, sy: number, vp: Viewport) {
  return { x: (sx - vp.panX) / vp.zoom, y: (sy - vp.panY) / vp.zoom }
}

/** Fit склада в canvas с полями. */
export function fitViewport(
  width_m: number,
  length_m: number,
  canvasW: number,
  canvasH: number,
  paddingPx = 40,
): Viewport {
  const usableW = Math.max(40, canvasW - paddingPx * 2)
  const usableH = Math.max(40, canvasH - paddingPx * 2)
  const zoom = Math.max(0.5, Math.min(usableW / width_m, usableH / length_m, 80))
  const contentW = width_m * zoom
  const contentH = length_m * zoom
  return {
    zoom,
    panX: (canvasW - contentW) / 2,
    panY: (canvasH - contentH) / 2,
  }
}

export function zoomAtPoint(
  vp: Viewport,
  screenX: number,
  screenY: number,
  factor: number,
  minZoom = 0.4,
  maxZoom = 120,
): Viewport {
  const before = screenToWorld(screenX, screenY, vp)
  const zoom = Math.min(maxZoom, Math.max(minZoom, vp.zoom * factor))
  return {
    zoom,
    panX: screenX - before.x * zoom,
    panY: screenY - before.y * zoom,
  }
}

/** Шаг сетки в метрах по текущему zoom (адаптивно). */
export function adaptiveGridStepM(zoom: number): number {
  const pxTarget = 48
  const raw = pxTarget / zoom
  const candidates = [0.5, 1, 2, 5, 10, 20, 50]
  for (const c of candidates) {
    if (c >= raw * 0.7) return c
  }
  return 50
}

export function snapValue(v: number, step: number, enabled: boolean) {
  if (!enabled || step <= 0) return v
  return Math.round(v / step) * step
}

/** Длина масштабной линейки (метры) под ~100 px. */
export function scaleBarMeters(zoom: number): number {
  const targetPx = 100
  const raw = targetPx / zoom
  const candidates = [1, 2, 5, 10, 20, 50, 100]
  for (const c of candidates) {
    if (c >= raw * 0.6) return c
  }
  return 100
}
