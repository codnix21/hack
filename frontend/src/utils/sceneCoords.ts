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

export interface CameraFitOptions {
  /** Вертикальный FOV камеры, градусы (как у PerspectiveCamera). */
  fovDeg?: number
  /** aspect = width/height контейнера Canvas. */
  aspect?: number
  /** Запас кадра (>1). */
  padding?: number
  mode?: 'iso' | 'top'
}

export interface CameraFitResult {
  position: [number, number, number]
  target: [number, number, number]
  near: number
  far: number
}

/** Габариты помещения из DTO (не по «двум случайным объектам»). */
export function warehouseRoomExtents(layout: Pick<WarehouseLayout, 'width_m' | 'length_m'>): WarehouseExtentsM {
  return {
    widthM: Math.max(1, Number(layout.width_m) || 1),
    lengthM: Math.max(1, Number(layout.length_m) || 1),
  }
}

/** AABB пола в координатах сцены (центр склада в нуле). */
export function sceneRoomBounds(extents: WarehouseExtentsM) {
  const hw = extents.widthM / 2
  const hl = extents.lengthM / 2
  return {
    minX: -hw,
    maxX: hw,
    minZ: -hl,
    maxZ: hl,
    halfDiag: Math.hypot(hw, hl),
  }
}

/**
 * Дистанция камеры, чтобы прямоугольник пола целиком попал в перспективу.
 * Учитывает FOV и aspect: для вытянутого склада берётся более жёсткая ось.
 */
export function fitDistanceForRoom(
  extents: WarehouseExtentsM,
  opts: Pick<CameraFitOptions, 'fovDeg' | 'aspect' | 'padding'> = {},
): number {
  const fovDeg = opts.fovDeg ?? 42
  const aspect = Math.max(0.35, opts.aspect ?? 16 / 9)
  const padding = opts.padding ?? 1.28
  const halfW = Math.max(extents.widthM, 1) / 2
  const halfL = Math.max(extents.lengthM, 1) / 2
  const vFov = (fovDeg * Math.PI) / 180
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  // Покрыть половину длины по вертикали кадра и половину ширины по горизонтали
  const distV = halfL / Math.tan(vFov / 2)
  const distH = halfW / Math.tan(hFov / 2)
  // Сфера, описывающая пол — страховка при косом ракурсе
  const distSphere = Math.hypot(halfW, halfL) / Math.sin(vFov / 2)
  return Math.max(distV, distH, distSphere * 0.72, 6) * padding
}

/** Камера «весь склад в кадре» (изометрия / top). Геометрию не сдвигает — только eye/target. */
export function fitCameraPosition(
  extents: WarehouseExtentsM,
  opts: CameraFitOptions = {},
): CameraFitResult {
  const mode = opts.mode ?? 'iso'
  const dist = fitDistanceForRoom(extents, opts)
  const span = Math.max(extents.widthM, extents.lengthM, 8)
  const near = Math.max(0.05, span / 800)
  const far = Math.max(800, span * 40)

  if (mode === 'top') {
    return {
      position: [0, dist, 0.001],
      target: [0, 0, 0],
      near,
      far,
    }
  }

  // Изометрия: направление (1, elev, 1), длина = dist
  const elev = 0.62
  const horiz = Math.sqrt(Math.max(1e-6, 1 - elev * elev))
  const s = 1 / Math.SQRT2
  return {
    position: [dist * horiz * s, dist * elev, dist * horiz * s],
    target: [0, 0, 0],
    near,
    far,
  }
}

export function topCameraPosition(
  extents: WarehouseExtentsM,
  opts: Omit<CameraFitOptions, 'mode'> = {},
): CameraFitResult {
  return fitCameraPosition(extents, { ...opts, mode: 'top', fovDeg: opts.fovDeg ?? 42 })
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
