/**
 * Единый адаптер координат плана → Three.js.
 *
 * План (2D / DES): начало в левом верхнем углу, X вправо, Y вниз, единицы — метры
 * (в VisualizationLayout координаты в пикселях сцены; metersToPx + pad из normalizeLayout).
 *
 * Three.js: Y вверх, пол на плоскости XZ. 1 единица сцены = 1 метр.
 * Центр склада в (0,0,0); план Y → +Z (без зеркалирования по глубине).
 */

import type { VisualizationLayout, WarehouseLayout } from '../types'

export const LAYOUT_PAD_PX = 16

export interface PlanMeters {
  xM: number
  yM: number
}

export interface SceneXZ {
  x: number
  z: number
}

export interface WarehouseExtentsM {
  widthM: number
  lengthM: number
}

/** Габариты склада в метрах из VisualizationLayout (предпочтительно raw.canvas). */
export function vizExtentsM(layout: VisualizationLayout): WarehouseExtentsM {
  const rawW = layout.raw?.canvas?.width_m
  const rawL = layout.raw?.canvas?.length_m
  if (rawW != null && rawL != null && rawW > 0 && rawL > 0) {
    return { widthM: Number(rawW), lengthM: Number(rawL) }
  }
  const mtp = Math.max(layout.metersToPx || 1, 1e-6)
  const widthM = Math.max(1, (layout.width - LAYOUT_PAD_PX * 2) / mtp)
  const lengthM = Math.max(1, (layout.height - LAYOUT_PAD_PX * 2) / mtp)
  return { widthM, lengthM }
}

/** Пиксели нормализованного плана → метры плана. */
export function vizPxToMeters(layout: VisualizationLayout, xPx: number, yPx: number): PlanMeters {
  const mtp = Math.max(layout.metersToPx || 1, 1e-6)
  return {
    xM: (xPx - LAYOUT_PAD_PX) / mtp,
    yM: (yPx - LAYOUT_PAD_PX) / mtp,
  }
}

/** Метры плана → сцена Three.js (центр склада в нуле). */
export function metersToScene(
  xM: number,
  yM: number,
  extents: WarehouseExtentsM,
): SceneXZ {
  return {
    x: xM - extents.widthM / 2,
    z: yM - extents.lengthM / 2,
  }
}

/** Пиксели VisualizationLayout → сцена. */
export function vizPxToScene(layout: VisualizationLayout, xPx: number, yPx: number): SceneXZ {
  const { xM, yM } = vizPxToMeters(layout, xPx, yPx)
  return metersToScene(xM, yM, vizExtentsM(layout))
}

/** Размер в пикселях плана → метры. */
export function vizSizePxToMeters(layout: VisualizationLayout, sizePx: number): number {
  const mtp = Math.max(layout.metersToPx || 1, 1e-6)
  return sizePx / mtp
}

/** Прямоугольник плана (px) → позиция центра и размеры коробки в метрах сцены. */
export function vizRectToSceneBox(
  layout: VisualizationLayout,
  xPx: number,
  yPx: number,
  wPx: number,
  hPx: number,
): { cx: number; cz: number; sx: number; sz: number } {
  const a = vizPxToScene(layout, xPx, yPx)
  const b = vizPxToScene(layout, xPx + wPx, yPx + hPx)
  return {
    cx: (a.x + b.x) / 2,
    cz: (a.z + b.z) / 2,
    sx: Math.max(0.05, Math.abs(b.x - a.x)),
    sz: Math.max(0.05, Math.abs(b.z - a.z)),
  }
}

/** WarehouseLayout (метры) → сцена. */
export function warehouseMetersToScene(
  layout: WarehouseLayout,
  xM: number,
  yM: number,
): SceneXZ {
  return metersToScene(xM, yM, { widthM: layout.width_m, lengthM: layout.length_m })
}

/** Камера «весь склад в кадре» (изометрия). */
export function fitCameraPosition(extents: WarehouseExtentsM): { position: [number, number, number]; target: [number, number, number] } {
  const span = Math.max(extents.widthM, extents.lengthM, 8)
  const dist = span * 0.95
  return {
    position: [dist * 0.85, dist * 0.75, dist * 0.85],
    target: [0, 0, 0],
  }
}

export function topCameraPosition(extents: WarehouseExtentsM): { position: [number, number, number]; target: [number, number, number] } {
  const span = Math.max(extents.widthM, extents.lengthM, 8)
  return {
    position: [0, span * 1.35, 0.01],
    target: [0, 0, 0],
  }
}

/** Полилиния маршрута VisualizationLayout (px) → точки сцены; blocked → []. */
export function vizRouteToScenePoints(
  layout: VisualizationLayout,
  route: { points?: { x: number; y: number }[]; blocked?: boolean },
): SceneXZ[] {
  if (route.blocked) return []
  const pts = route.points || []
  if (pts.length < 2) return []
  return pts.map((p) => vizPxToScene(layout, p.x, p.y))
}

/** Длина полилинии в метрах сцены (эквивалент метрам плана). */
export function scenePolylineLengthM(points: SceneXZ[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dz = points[i].z - points[i - 1].z
    total += Math.hypot(dx, dz)
  }
  return total
}

/** Проверка бинарного GLB по magic «glTF». */
export function isGlbMagic(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false
  const u8 = new Uint8Array(buf, 0, 4)
  return u8[0] === 0x67 && u8[1] === 0x6c && u8[2] === 0x54 && u8[3] === 0x46
}
