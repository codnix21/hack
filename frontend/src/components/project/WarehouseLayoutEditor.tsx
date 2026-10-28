import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Crosshair,
  Hand,
  Maximize2,
  Plus,
  Route,
  Save,
  Trash2,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { projectsApi } from '../../api/projects'
import { getFriendlyError } from '../../api/client'
import type { LayoutObject, LayoutRoute, WarehouseLayout } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Badge } from '../ui/Badge'
import { toastError, toastSuccess } from '../../store/toastStore'
import { useThemeStore } from '../../store/themeStore'
import { readCanvasColors } from '../../utils/chartTheme'
import { dxfEntityTypeLabel } from '../../utils/labels'
import {
  adaptiveGridStepM,
  fitViewport,
  scaleBarMeters,
  screenToWorld,
  snapValue,
  worldToScreen,
  zoomAtPoint,
  type Viewport,
} from './layoutViewport'
import { Layout3DPreview } from './Layout3DPreview'

type EditorTool = 'select' | 'pan' | 'route'
type PlanViewMode = '2d' | '3d'

function routeLengthM(points: { x: number; y: number }[]) {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    total += Math.hypot(dx, dy)
  }
  return total
}

/** Расстояние от точки до отрезка (метры). */
function distPointToSeg(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-9) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Точка в ориентированном прямоугольнике (градусы CW, Y-down). */
export function pointInOrientedRect(
  px: number,
  py: number,
  o: { x: number; y: number; width: number; height: number; rotation?: number },
) {
  const rot = ((o.rotation || 0) * Math.PI) / 180
  const cx = o.x + o.width / 2
  const cy = o.y + o.height / 2
  const dx = px - cx
  const dy = py - cy
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  // inverse canvas rotate
  const lx = dx * c + dy * s
  const ly = -dx * s + dy * c
  return Math.abs(lx) <= o.width / 2 && Math.abs(ly) <= o.height / 2
}

const KIND_OPTIONS = [
  { value: 'rack', label: 'Стеллаж' },
  { value: 'obstacle', label: 'Препятствие' },
  { value: 'zone', label: 'Зона' },
  { value: 'charge', label: 'Зарядка' },
  { value: 'load', label: 'Приёмка' },
  { value: 'unload', label: 'Отгрузка' },
  { value: 'start', label: 'Старт роботов' },
  { value: 'wall', label: 'Стена / контур' },
]

const KIND_COLORS: Record<string, string> = {
  rack: '#64748b',
  obstacle: '#ef4444',
  zone: '#3b82f6',
  charge: '#22c55e',
  load: '#eab308',
  unload: '#f97316',
  start: '#8b5cf6',
  wall: '#1e293b',
}

interface Props {
  projectId: string
  readOnly?: boolean
}

function newId(kind: string) {
  return `${kind}_${Math.random().toString(36).slice(2, 9)}`
}

function formatArea(w: number, l: number) {
  const a = Number(w) * Number(l)
  if (!Number.isFinite(a)) return '—'
  return a.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

/** Клиентские координаты → метры планировки с учётом CSS-масштаба canvas. */
export function clientToLayoutMeters(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  width_m: number,
  length_m: number,
) {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  return {
    x: ((clientX - rect.left) / rect.width) * width_m,
    y: ((clientY - rect.top) / rect.height) * length_m,
  }
}

export function WarehouseLayoutEditor({ projectId, readOnly = false }: Props) {
  const qc = useQueryClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<WarehouseLayout | null>(null)
  const [planView, setPlanView] = useState<PlanViewMode>('2d')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dxfPreview, setDxfPreview] = useState<{
    entities: { id: string; suggested_kind: string; kind?: string; dxftype: string; layer: string }[]
    suggested_unit_to_m: number
    warnings?: string[]
    bounds: { xmin: number; ymin: number; xmax: number; ymax: number }
    filename?: string
  } | null>(null)
  const [unitToM, setUnitToM] = useState('0.001')
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [panDrag, setPanDrag] = useState<{ x: number; y: number; panX: number; panY: number } | null>(
    null,
  )
  const [tool, setTool] = useState<EditorTool>('select')
  const [snap, setSnap] = useState(true)
  const [cursorM, setCursorM] = useState<{ x: number; y: number } | null>(null)
  const [vp, setVp] = useState<Viewport>({ zoom: 8, panX: 40, panY: 40 })
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 560 })
  const fittedKey = useRef('')
  const historyRef = useRef<WarehouseLayout[]>([])
  const [historyLen, setHistoryLen] = useState(0)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [draftPoints, setDraftPoints] = useState<{ x: number; y: number }[]>([])
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [narrowViewport, setNarrowViewport] = useState(false)
  /** Пример-проект или узкий экран — без правки геометрии (просмотр + панорама). */
  const editLocked = readOnly || narrowViewport
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 1023px)')
    const apply = () => {
      setNarrowViewport(mq.matches)
      setInspectorOpen(!mq.matches)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const query = useQuery({
    queryKey: ['project-layout', projectId],
    queryFn: () => projectsApi.getLayout(projectId),
  })

  // Смена проекта сбрасывает локальную историю — Undo не переносит чужой план
  useEffect(() => {
    historyRef.current = []
    setHistoryLen(0)
    setLayout(null)
    setSelectedId(null)
    setSelectedRouteId(null)
    setDraftPoints([])
  }, [projectId])

  useEffect(() => {
    if (query.data) {
      setLayout(query.data)
      historyRef.current = []
      setHistoryLen(0)
    }
  }, [query.data])

  const commitLayout = (next: WarehouseLayout) => {
    if (layout) {
      historyRef.current = [...historyRef.current.slice(-19), structuredClone(layout)]
      setHistoryLen(historyRef.current.length)
    }
    setLayout(next)
  }

  const undoLayout = () => {
    const prev = historyRef.current.pop()
    setHistoryLen(historyRef.current.length)
    if (prev) {
      setLayout(prev)
      toastSuccess('Отменено последнее изменение плана (локально, до сохранения)')
    }
  }

  const saveMut = useMutation({
    mutationFn: () => projectsApi.saveLayout(projectId, layout!),
    onSuccess: () => {
      toastSuccess('План склада сохранён')
      void qc.invalidateQueries({ queryKey: ['project-layout', projectId] })
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: ['visualization', projectId] })
      void qc.invalidateQueries({ queryKey: ['project-params', projectId] })
      void qc.invalidateQueries({ queryKey: ['presentation-layout', projectId] })
      void qc.invalidateQueries({ queryKey: ['calculation', projectId] })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const dxfPreviewMut = useMutation({
    mutationFn: (file: File) => projectsApi.dxfPreview(projectId, file),
    onSuccess: (data) => {
      setDxfPreview(data)
      setUnitToM(String(data.suggested_unit_to_m ?? 0.001))
      toastSuccess('DXF разобран — назначьте типы объектов и подтвердите')
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const dxfConfirmMut = useMutation({
    mutationFn: () => {
      if (!dxfPreview) throw new Error('Нет превью')
      const entity_kinds: Record<string, string> = {}
      dxfPreview.entities.forEach((e) => {
        entity_kinds[e.id] = e.kind || e.suggested_kind || 'wall'
      })
      return projectsApi.dxfConfirm(projectId, {
        preview: dxfPreview,
        unit_to_m: Number(unitToM),
        entity_kinds,
      })
    },
    onSuccess: (p) => {
      setDxfPreview(null)
      if (p.layout) setLayout(p.layout as WarehouseLayout)
      toastSuccess('Чертёж DXF применён к плану')
      void qc.invalidateQueries({ queryKey: ['project-layout', projectId] })
      void qc.invalidateQueries({ queryKey: ['visualization', projectId] })
      void qc.invalidateQueries({ queryKey: ['presentation-layout', projectId] })
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const fitToWarehouse = useCallback(() => {
    if (!layout) return
    setVp(fitViewport(layout.width_m, layout.length_m, canvasSize.w, canvasSize.h))
  }, [layout, canvasSize.w, canvasSize.h])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      const w = Math.max(320, Math.floor(cr.width))
      const h = Math.max(360, Math.floor(cr.height))
      setCanvasSize({ w, h })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // авто-fit при первой загрузке плана / смене размеров склада
  useEffect(() => {
    if (!layout) return
    const key = `${layout.width_m}x${layout.length_m}:${canvasSize.w}x${canvasSize.h}`
    if (fittedKey.current === key) return
    fittedKey.current = key
    setVp(fitViewport(layout.width_m, layout.length_m, canvasSize.w, canvasSize.h))
  }, [layout, canvasSize.w, canvasSize.h])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !layout) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = canvasSize
    canvas.width = w
    canvas.height = h

    const colors = readCanvasColors()
    ctx.fillStyle = colors.floor
    ctx.fillRect(0, 0, w, h)

    const origin = worldToScreen(0, 0, vp)
    const corner = worldToScreen(layout.width_m, layout.length_m, vp)

    // floor
    ctx.fillStyle = colors.floor
    ctx.fillRect(origin.x, origin.y, corner.x - origin.x, corner.y - origin.y)

    // adaptive grid
    const stepM = adaptiveGridStepM(vp.zoom)
    ctx.strokeStyle = colors.grid
    ctx.lineWidth = 1
    for (let xm = 0; xm <= layout.width_m + 1e-6; xm += stepM) {
      const p = worldToScreen(xm, 0, vp)
      ctx.beginPath()
      ctx.moveTo(p.x + 0.5, origin.y)
      ctx.lineTo(p.x + 0.5, corner.y)
      ctx.stroke()
    }
    for (let ym = 0; ym <= layout.length_m + 1e-6; ym += stepM) {
      const p = worldToScreen(0, ym, vp)
      ctx.beginPath()
      ctx.moveTo(origin.x, p.y + 0.5)
      ctx.lineTo(corner.x, p.y + 0.5)
      ctx.stroke()
    }

    // warehouse border
    ctx.strokeStyle = 'rgba(240, 115, 22, 0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(origin.x, origin.y, corner.x - origin.x, corner.y - origin.y)

    const showLabels = vp.zoom >= 3
    for (const o of layout.objects) {
      if (o.id === 'wall_contour') continue
      const tl = worldToScreen(o.x, o.y, vp)
      const ww = o.width * vp.zoom
      const hh = o.height * vp.zoom
      const rot = ((o.rotation || 0) * Math.PI) / 180
      const cx = tl.x + ww / 2
      const cy = tl.y + hh / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rot)
      ctx.fillStyle = KIND_COLORS[o.kind] || '#94a3b8'
      ctx.globalAlpha = o.id === selectedId ? 0.95 : 0.82
      ctx.fillRect(-ww / 2, -hh / 2, ww, hh)
      ctx.globalAlpha = 1
      ctx.strokeStyle = o.id === selectedId ? '#f07316' : 'rgba(255,255,255,0.35)'
      ctx.lineWidth = o.id === selectedId ? 2.5 : 1.1
      ctx.strokeRect(-ww / 2, -hh / 2, ww, hh)
      // kind mark
      if (o.kind === 'obstacle') {
        ctx.strokeStyle = '#b91c1c'
        ctx.beginPath()
        ctx.moveTo(-ww / 2 + 4, -hh / 2 + 4)
        ctx.lineTo(ww / 2 - 4, hh / 2 - 4)
        ctx.moveTo(ww / 2 - 4, -hh / 2 + 4)
        ctx.lineTo(-ww / 2 + 4, hh / 2 - 4)
        ctx.stroke()
      }
      if (showLabels) {
        ctx.fillStyle = 'rgba(242,244,248,0.9)'
        ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif'
        const label = String(o.name || o.kind || '').slice(0, 16)
        if (label && ww > 28) ctx.fillText(label, -ww / 2 + 4, -hh / 2 + 14)
      }
      ctx.restore()
    }

    // ручные маршруты
    const drawPolyline = (
      pts: { x: number; y: number }[],
      stroke: string,
      lineWidth: number,
      dashed = false,
    ) => {
      if (pts.length < 1) return
      ctx.beginPath()
      const p0 = worldToScreen(pts[0].x, pts[0].y, vp)
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < pts.length; i++) {
        const p = worldToScreen(pts[i].x, pts[i].y, vp)
        ctx.lineTo(p.x, p.y)
      }
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      ctx.setLineDash(dashed ? [8, 6] : [])
      ctx.stroke()
      ctx.setLineDash([])
      for (const pt of pts) {
        const s = worldToScreen(pt.x, pt.y, vp)
        ctx.beginPath()
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = stroke
        ctx.fill()
      }
    }
    for (const r of layout.routes || []) {
      const selected = r.id === selectedRouteId
      drawPolyline(r.points, selected ? '#c2410c' : '#ea580c', selected ? 3 : 2)
    }
    if (draftPoints.length) {
      const preview = cursorM ? [...draftPoints, cursorM] : draftPoints
      drawPolyline(preview, '#f97316', 2, true)
    }

    // scale bar
    const barM = scaleBarMeters(vp.zoom)
    const barPx = barM * vp.zoom
    const bx = 16
    const by = h - 22
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillRect(bx - 4, by - 16, barPx + 48, 28)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + barPx, by)
    ctx.moveTo(bx, by - 4)
    ctx.lineTo(bx, by + 4)
    ctx.moveTo(bx + barPx, by - 4)
    ctx.lineTo(bx + barPx, by + 4)
    ctx.stroke()
    ctx.fillStyle = '#334155'
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
    ctx.fillText(`${barM} м`, bx + barPx + 8, by + 4)
  }, [layout, vp, selectedId, selectedRouteId, draftPoints, cursorM, canvasSize, theme])

  const selected = layout?.objects.find((o) => o.id === selectedId) || null
  const selectedRoute = layout?.routes?.find((r) => r.id === selectedRouteId) || null
  const layoutRoutes = layout?.routes || []

  const toMeters = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas || !layout) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const sx = ((clientX - rect.left) / rect.width) * canvas.width
    const sy = ((clientY - rect.top) / rect.height) * canvas.height
    return screenToWorld(sx, sy, vp)
  }

  const hitTest = (mx: number, my: number) => {
    if (!layout) return null
    for (let i = layout.objects.length - 1; i >= 0; i--) {
      const o = layout.objects[i]
      if (o.id === 'wall_contour') continue
      if (pointInOrientedRect(mx, my, o)) return o
    }
    return null
  }

  const hitTestRoute = (mx: number, my: number) => {
    if (!layout?.routes?.length) return null
    const tolM = Math.max(0.4, 6 / vp.zoom)
    for (let ri = layout.routes.length - 1; ri >= 0; ri--) {
      const r = layout.routes[ri]
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1]
        const b = r.points[i]
        if (distPointToSeg(mx, my, a.x, a.y, b.x, b.y) <= tolM) return r
      }
    }
    return null
  }

  const finishDraftRoute = () => {
    if (!layout || editLocked || draftPoints.length < 2) {
      if (draftPoints.length === 1) toastError('Нужны минимум 2 точки маршрута')
      return
    }
    const route: LayoutRoute = {
      id: newId('route'),
      name: `Маршрут ${(layout.routes?.length || 0) + 1}`,
      points: draftPoints.map((p) => ({
        x: Math.round(p.x * 1000) / 1000,
        y: Math.round(p.y * 1000) / 1000,
      })),
      manual: true,
    }
    commitLayout({ ...layout, routes: [...(layout.routes || []), route] })
    setDraftPoints([])
    setSelectedRouteId(route.id)
    setSelectedId(null)
    setTool('select')
    toastSuccess('Маршрут добавлен — сохраните план')
  }

  const cancelDraftRoute = () => {
    setDraftPoints([])
  }

  const removeSelectedRoute = () => {
    if (!layout || !selectedRouteId || editLocked) return
    commitLayout({
      ...layout,
      routes: (layout.routes || []).filter((r) => r.id !== selectedRouteId),
    })
    setSelectedRouteId(null)
  }

  const updateSelectedRoute = (patch: Partial<LayoutRoute>) => {
    if (!layout || !selectedRouteId || editLocked) return
    commitLayout({
      ...layout,
      routes: (layout.routes || []).map((r) =>
        r.id === selectedRouteId ? { ...r, ...patch } : r,
      ),
    })
  }

  useEffect(() => {
    if (tool !== 'route') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setDraftPoints([])
      } else if (e.key === 'Enter') {
        e.preventDefault()
        finishDraftRoute()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finishDraftRoute зависит от draft/layout
  }, [tool, draftPoints, layout, editLocked])

  const clampObject = (o: LayoutObject, x: number, y: number) => {
    if (!layout) return { x, y }
    const step = snap ? adaptiveGridStepM(vp.zoom) : 0
    let nx = snapValue(x, step, snap)
    let ny = snapValue(y, step, snap)
    nx = Math.max(0, Math.min(layout.width_m - o.width, nx))
    ny = Math.max(0, Math.min(layout.length_m - o.height, ny))
    return { x: nx, y: ny }
  }

  const updateSelected = (patch: Partial<LayoutObject>) => {
    if (!layout || !selectedId || editLocked) return
    commitLayout({
      ...layout,
      objects: layout.objects.map((o) => (o.id === selectedId ? { ...o, ...patch } : o)),
    })
  }

  const addObject = (kind: string) => {
    if (!layout || editLocked) return
    const width = kind === 'rack' ? 8 : 4
    const height = kind === 'rack' ? 12 : 3
    // центр текущего вида в метрах
    const center = screenToWorld(canvasSize.w / 2, canvasSize.h / 2, vp)
    let x = center.x - width / 2
    let y = center.y - height / 2
    x = Math.max(0, Math.min(layout.width_m - width, x))
    y = Math.max(0, Math.min(layout.length_m - height, y))
    if (snap) {
      const step = adaptiveGridStepM(vp.zoom)
      x = snapValue(x, step, true)
      y = snapValue(y, step, true)
    }
    const obj: LayoutObject = {
      id: newId(kind),
      kind,
      name: KIND_OPTIONS.find((k) => k.value === kind)?.label || kind,
      x,
      y,
      width,
      height,
      rotation: 0,
    }
    commitLayout({ ...layout, objects: [...layout.objects, obj] })
    setSelectedId(obj.id)
    setTool('select')
  }

  const removeSelected = () => {
    if (!layout || !selectedId || editLocked) return
    if (selectedId === 'wall_contour') {
      toastError('Контур склада нельзя удалить')
      return
    }
    commitLayout({ ...layout, objects: layout.objects.filter((o) => o.id !== selectedId) })
    setSelectedId(null)
  }

  if (query.isLoading || !layout) {
    return <p className="text-sm text-[var(--nc-muted)]">Загрузка плана…</p>
  }

  const outOfBounds =
    selected &&
    (selected.x < 0 ||
      selected.y < 0 ||
      selected.x + selected.width > layout.width_m + 0.01 ||
      selected.y + selected.height > layout.length_m + 0.01)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Метры · OBB</Badge>
        {layout.source === 'default_example' || layout.objects.some((o) => o.example) ? (
          <Badge variant="warning">Примерная геометрия</Badge>
        ) : null}
        <span className="text-xs text-[var(--nc-muted)]" data-testid="layout-undo-scope">
          Undo локальный (до сохранения / перезагрузки)
        </span>
      </div>

      {/* Toolbar groups */}
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--nc-radius-lg)] border border-[var(--nc-border)] bg-[var(--nc-surface-muted)] p-2">
        <div className="flex items-center gap-1" role="group" aria-label="Инструмент">
          <Button
            size="sm"
            variant={tool === 'select' ? 'primary' : 'outline'}
            data-testid="layout-tool-select"
            onClick={() => {
              setTool('select')
              setDraftPoints([])
            }}
            aria-pressed={tool === 'select'}
            title="Выбор и перемещение"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Выбор
          </Button>
          <Button
            size="sm"
            variant={tool === 'pan' ? 'primary' : 'outline'}
            data-testid="layout-tool-pan"
            onClick={() => {
              setTool('pan')
              setDraftPoints([])
            }}
            aria-pressed={tool === 'pan'}
            title="Панорама"
          >
            <Hand className="h-3.5 w-3.5" />
            Панорама
          </Button>
          {!editLocked && (
            <Button
              size="sm"
              variant={tool === 'route' ? 'primary' : 'outline'}
              data-testid="layout-tool-route"
              onClick={() => {
                setTool('route')
                setSelectedId(null)
                setSelectedRouteId(null)
              }}
              aria-pressed={tool === 'route'}
              title="Клик — точки маршрута, Enter / «Готово» — завершить"
            >
              <Route className="h-3.5 w-3.5" />
              Маршрут
            </Button>
          )}
        </div>
        <div className="h-6 w-px bg-[var(--nc-border)]" aria-hidden />
        <div className="flex items-center gap-1" role="group" aria-label="Режим плана">
          <Button
            size="sm"
            variant={planView === '2d' ? 'primary' : 'outline'}
            data-testid="layout-view-2d"
            aria-pressed={planView === '2d'}
            onClick={() => setPlanView('2d')}
          >
            2D — План
          </Button>
          <Button
            size="sm"
            variant={planView === '3d' ? 'primary' : 'outline'}
            data-testid="layout-view-3d"
            aria-pressed={planView === '3d'}
            onClick={() => setPlanView('3d')}
            title="Пространственный вид той же планировки"
          >
            3D — Пространство
          </Button>
        </div>
        <div className="h-6 w-px bg-[var(--nc-border)]" aria-hidden />
        <div className="flex items-center gap-1" role="group" aria-label="Вид">
          <Button
            size="sm"
            variant="outline"
            data-testid="layout-zoom-out"
            disabled={planView !== '2d'}
            aria-label="Уменьшить масштаб"
            onClick={() => setVp((v) => ({ ...v, zoom: Math.max(0.4, v.zoom / 1.25) }))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="layout-zoom-in"
            aria-label="Увеличить масштаб"
            disabled={planView !== '2d'}
            onClick={() => setVp((v) => ({ ...v, zoom: Math.min(120, v.zoom * 1.25) }))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="layout-fit"
            disabled={planView !== '2d'}
            onClick={fitToWarehouse}
            title="По размеру склада"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            По размеру
          </Button>
          <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nc-muted)]">
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
              data-testid="layout-snap"
            />
            Сетка
          </label>
        </div>
        {!editLocked && (
          <>
            <div className="h-6 w-px bg-[var(--nc-border)]" aria-hidden />
            <Button size="sm" variant="outline" data-testid="layout-undo" disabled={historyLen === 0} onClick={undoLayout}>
              <Undo2 className="h-3.5 w-3.5" />
              Отменить
            </Button>
            <div className="h-6 w-px bg-[var(--nc-border)]" aria-hidden />
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Объекты">
              <Button size="sm" variant="outline" data-testid="layout-add-rack" onClick={() => addObject('rack')}>
                <Plus className="h-3.5 w-3.5" />
                Стеллаж
              </Button>
              <Button size="sm" variant="outline" onClick={() => addObject('obstacle')}>
                <Plus className="h-3.5 w-3.5" />
                Препятствие
              </Button>
              <Button size="sm" variant="outline" onClick={() => addObject('load')}>
                <Plus className="h-3.5 w-3.5" />
                Приёмка
              </Button>
              <Button size="sm" variant="outline" onClick={() => addObject('unload')}>
                <Plus className="h-3.5 w-3.5" />
                Отгрузка
              </Button>
              <Button size="sm" variant="outline" onClick={() => addObject('charge')}>
                <Plus className="h-3.5 w-3.5" />
                Зарядка
              </Button>
              <Button size="sm" variant="outline" onClick={() => addObject('start')}>
                <Plus className="h-3.5 w-3.5" />
                Старт
              </Button>
            </div>
            <label className="inline-flex">
              <input
                data-testid="layout-dxf-input"
                type="file"
                accept=".dxf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) dxfPreviewMut.mutate(f)
                  e.target.value = ''
                }}
              />
              <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border border-[var(--nc-border-strong)] bg-[var(--nc-surface)] px-3 text-sm font-medium text-[var(--nc-ink)] hover:border-brand-500/50">
                <Upload className="h-3.5 w-3.5" />
                DXF
              </span>
            </label>
            <Button size="sm" data-testid="layout-save" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
              <Save className="h-3.5 w-3.5" />
              Сохранить план
            </Button>
          </>
        )}
      </div>

      {narrowViewport && !readOnly ? (
        <p className="text-xs text-[var(--nc-warning)] lg:hidden" data-testid="layout-mobile-hint">
          Режим просмотра на узком экране: правка объектов и маршрутов отключена. Откройте широкий
          экран для редактирования — геометрия в метрах не меняется при просмотре.
        </p>
      ) : null}

      <div
        className={`grid gap-3 ${inspectorOpen ? 'lg:grid-cols-[minmax(0,1fr)_220px]' : ''}`}
      >
        {planView === '3d' && layout ? (
          <div
            className="relative min-h-[32rem] overflow-hidden rounded-[var(--nc-radius-lg)] border border-[var(--nc-border)] bg-[var(--nc-surface)] p-2 shadow-panel"
            data-testid="layout-canvas-wrap"
          >
            <Layout3DPreview
              layout={layout}
              selectedId={selectedId}
              onSelectId={(id) => {
                setSelectedId(id)
                setSelectedRouteId(null)
              }}
            />
            {/* Keep 2D canvas mounted off-screen so viewport/state survive mode switch */}
            <canvas ref={canvasRef} className="pointer-events-none absolute h-0 w-0 opacity-0" data-testid="layout-canvas" aria-hidden />
          </div>
        ) : (
        <div
          ref={wrapRef}
          className="relative h-[min(78vh,780px)] min-h-[32rem] overflow-hidden rounded-[var(--nc-radius-lg)] border border-[var(--nc-border)] nc-canvas-surface shadow-panel"
          data-testid="layout-canvas-wrap"
        >
          <canvas
            ref={canvasRef}
            className={`block h-full w-full touch-none ${tool === 'pan' || panDrag ? 'cursor-grab' : 'cursor-crosshair'}`}
            data-testid="layout-canvas"
            onWheel={(e) => {
              e.preventDefault()
              const canvas = canvasRef.current
              if (!canvas) return
              const rect = canvas.getBoundingClientRect()
              const sx = ((e.clientX - rect.left) / rect.width) * canvas.width
              const sy = ((e.clientY - rect.top) / rect.height) * canvas.height
              const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12
              setVp((v) => zoomAtPoint(v, sx, sy, factor))
            }}
            onMouseDown={(e) => {
              if (!layout) return
              const { x, y } = toMeters(e.clientX, e.clientY)
              setCursorM({ x, y })
              if (tool === 'pan' || e.button === 1 || e.altKey) {
                setPanDrag({ x: e.clientX, y: e.clientY, panX: vp.panX, panY: vp.panY })
                return
              }
              if (editLocked) return
              if (tool === 'route') {
                e.preventDefault()
                const step = snap ? adaptiveGridStepM(vp.zoom) : 0
                const px = snapValue(x, step, snap)
                const py = snapValue(y, step, snap)
                const cx = Math.max(0, Math.min(layout.width_m, px))
                const cy = Math.max(0, Math.min(layout.length_m, py))
                setDraftPoints((prev) => [...prev, { x: cx, y: cy }])
                setSelectedId(null)
                setSelectedRouteId(null)
                return
              }
              const hit = hitTest(x, y)
              if (hit) {
                setSelectedId(hit.id)
                setSelectedRouteId(null)
                historyRef.current = [...historyRef.current.slice(-19), structuredClone(layout)]
                setHistoryLen(historyRef.current.length)
                setDrag({ id: hit.id, ox: x - hit.x, oy: y - hit.y })
                return
              }
              const hitR = hitTestRoute(x, y)
              if (hitR) {
                setSelectedRouteId(hitR.id)
                setSelectedId(null)
                return
              }
              setSelectedId(null)
              setSelectedRouteId(null)
              setPanDrag({ x: e.clientX, y: e.clientY, panX: vp.panX, panY: vp.panY })
            }}
            onDoubleClick={(e) => {
              if (tool !== 'route' || editLocked) return
              e.preventDefault()
              finishDraftRoute()
            }}
            onMouseMove={(e) => {
              const { x, y } = toMeters(e.clientX, e.clientY)
              setCursorM({ x, y })
              if (panDrag) {
                const canvas = canvasRef.current
                if (!canvas) return
                const rect = canvas.getBoundingClientRect()
                const scaleX = canvas.width / rect.width
                const scaleY = canvas.height / rect.height
                setVp((v) => ({
                  ...v,
                  panX: panDrag.panX + (e.clientX - panDrag.x) * scaleX,
                  panY: panDrag.panY + (e.clientY - panDrag.y) * scaleY,
                }))
                return
              }
              if (!drag || !layout || editLocked) return
              const obj = layout.objects.find((o) => o.id === drag.id)
              if (!obj) return
              const next = clampObject(obj, x - drag.ox, y - drag.oy)
              setLayout({
                ...layout,
                objects: layout.objects.map((o) => (o.id === drag.id ? { ...o, ...next } : o)),
              })
            }}
            onMouseUp={() => {
              setDrag(null)
              setPanDrag(null)
            }}
            onMouseLeave={() => {
              setDrag(null)
              setPanDrag(null)
              setCursorM(null)
            }}
          />
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex flex-wrap items-end justify-between gap-2">
            <p className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface)]/95 px-2 py-1 text-xs text-[var(--nc-muted)]" data-testid="layout-size-label">
              Размер: {layout.width_m} × {layout.length_m} м · {formatArea(layout.width_m, layout.length_m)} м²
              {cursorM ? ` · курсор ${cursorM.x.toFixed(1)}, ${cursorM.y.toFixed(1)} м` : ''}
              {snap ? ` · шаг ${adaptiveGridStepM(vp.zoom)} м` : ''}
              {layoutRoutes.length ? ` · маршрутов ${layoutRoutes.length}` : ''}
            </p>
            <p className="rounded border border-[var(--nc-border)] bg-[var(--nc-surface)]/95 px-2 py-1 font-mono text-[11px] text-[var(--nc-faint)]" data-testid="layout-zoom-label">
              {vp.zoom.toFixed(1)} px/м
            </p>
          </div>
          {tool === 'route' && !editLocked ? (
            <div className="absolute left-2 top-2 flex flex-wrap items-center gap-2 rounded border border-[var(--nc-accent-line)] bg-[var(--nc-surface)]/95 p-2 shadow-sm">
              <p className="text-xs text-[var(--nc-text)]">
                Маршрут: клик — точка ({draftPoints.length})
                {draftPoints.length >= 2
                  ? ` · ${routeLengthM(draftPoints).toFixed(1)} м`
                  : ''}
                . Двойной клик / Enter — готово, Esc — отмена.
              </p>
              <Button
                size="sm"
                data-testid="layout-route-finish"
                disabled={draftPoints.length < 2}
                onClick={finishDraftRoute}
              >
                <Check className="h-3.5 w-3.5" />
                Готово
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelDraftRoute}>
                Отмена
              </Button>
            </div>
          ) : null}
        </div>
        )}

        <div className="nc-panel space-y-3 p-3" data-testid="layout-inspector">
          <div className="flex items-center justify-between gap-2">
            <p className="nc-section-label">Инспектор</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              data-testid="layout-inspector-toggle"
              aria-expanded={inspectorOpen}
              onClick={() => setInspectorOpen((v) => !v)}
            >
              {inspectorOpen ? 'Свернуть' : 'Показать'}
            </Button>
          </div>
          {!inspectorOpen ? (
            <p className="text-xs text-[var(--nc-muted)]">Свойства объекта скрыты — больше места для плана.</p>
          ) : null}
          {inspectorOpen ? (
            <>
          <p className="text-sm font-semibold text-[var(--nc-ink)]">Размеры объекта</p>
          <Input
            label="Ширина, м"
            type="number"
            step="0.1"
            disabled={editLocked}
            value={String(layout.width_m)}
            onChange={(e) => {
              const width_m = Math.max(5, Number(e.target.value) || 5)
              commitLayout({
                ...layout,
                width_m,
                objects: layout.objects.map((o) =>
                  o.id === 'wall_contour' ? { ...o, width: width_m, height: layout.length_m, x: 0, y: 0 } : o,
                ),
              })
            }}
          />
          <Input
            label="Длина, м"
            type="number"
            step="0.1"
            disabled={editLocked}
            value={String(layout.length_m)}
            onChange={(e) => {
              const length_m = Math.max(5, Number(e.target.value) || 5)
              commitLayout({
                ...layout,
                length_m,
                objects: layout.objects.map((o) =>
                  o.id === 'wall_contour' ? { ...o, width: layout.width_m, height: length_m, x: 0, y: 0 } : o,
                ),
              })
            }}
          />
          {selectedRoute ? (
            <>
              <p className="pt-2 text-sm font-semibold text-[var(--nc-ink)]">Маршрут</p>
              <Input
                label="Название"
                disabled={editLocked}
                value={selectedRoute.name || ''}
                onChange={(e) => updateSelectedRoute({ name: e.target.value })}
              />
              <p className="text-xs text-[var(--nc-muted)]">
                Точек: {selectedRoute.points.length} · длина{' '}
                {routeLengthM(selectedRoute.points).toFixed(1)} м
              </p>
              <p className="text-[11px] text-[var(--nc-muted)]">
                В DES этот маршрут используется вместо авто-A*. Сохраните план.
              </p>
              <p className="font-mono text-[10px] text-[var(--nc-faint)]">ID: {selectedRoute.id}</p>
              {!editLocked && (
                <Button size="sm" variant="ghost" className="text-red-700" onClick={removeSelectedRoute}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить маршрут
                </Button>
              )}
            </>
          ) : selected ? (
            <>
              <p className="pt-2 text-sm font-semibold text-[var(--nc-ink)]">Объект</p>
              <Input
                label="Название"
                disabled={editLocked}
                value={selected.name}
                onChange={(e) => updateSelected({ name: e.target.value })}
              />
              <Select
                label="Тип"
                disabled={editLocked || selected.id === 'wall_contour'}
                value={selected.kind}
                options={KIND_OPTIONS}
                onChange={(e) => updateSelected({ kind: e.target.value })}
              />
              <Input
                label="X, м"
                type="number"
                step="0.1"
                disabled={editLocked}
                value={String(selected.x)}
                onChange={(e) => updateSelected({ x: Number(e.target.value) })}
              />
              <Input
                label="Y, м"
                type="number"
                step="0.1"
                disabled={editLocked}
                value={String(selected.y)}
                onChange={(e) => updateSelected({ y: Number(e.target.value) })}
              />
              <Input
                label="Ширина, м"
                type="number"
                step="0.1"
                disabled={editLocked}
                value={String(selected.width)}
                onChange={(e) => updateSelected({ width: Math.max(0.2, Number(e.target.value)) })}
              />
              <Input
                label="Длина, м"
                type="number"
                step="0.1"
                disabled={editLocked}
                value={String(selected.height)}
                onChange={(e) => updateSelected({ height: Math.max(0.2, Number(e.target.value)) })}
              />
              <Input
                label="Поворот, °"
                type="number"
                step="5"
                disabled={editLocked || selected.id === 'wall_contour'}
                value={String(selected.rotation || 0)}
                onChange={(e) => updateSelected({ rotation: Number(e.target.value) || 0 })}
                data-testid="layout-rotation-input"
              />
              <p className="text-[11px] text-[var(--nc-muted)]" data-testid="layout-rotation-note">
                Поворот учитывается в редакторе, hit-test и A* (OBB). Не CAD-точность.
              </p>
              {outOfBounds ? (
                <p className="text-xs text-[var(--nc-warning)]" data-testid="layout-oob-warning">
                  Объект выходит за границы склада — скорректируйте координаты или размеры.
                </p>
              ) : null}
              <p className="font-mono text-[10px] text-[var(--nc-faint)]">ID: {selected.id}</p>
              {!editLocked && (
                <Button size="sm" variant="ghost" className="text-red-700" onClick={removeSelected}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить
                </Button>
              )}
            </>
          ) : (
            <div className="space-y-2 text-xs text-[var(--nc-muted)]">
              <p className="font-medium text-[var(--nc-ink)]">Ничего не выбрано</p>
              <p>Клик по объекту — свойства. Колёсико — масштаб, пустая область — панорама.</p>
              <p className="text-[var(--nc-muted)]">
                Инструмент «Маршрут» — выставить точки вручную (оранжевая линия). Без ручных
                маршрутов DES строит пути через A*.
              </p>
              {layoutRoutes.length > 0 ? (
                <ul className="space-y-1 border-t border-[var(--nc-border-subtle)] pt-2">
                  {layoutRoutes.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="w-full rounded px-1 py-0.5 text-left hover:bg-[var(--nc-surface-hover)]"
                        onClick={() => {
                          setSelectedRouteId(r.id)
                          setSelectedId(null)
                        }}
                      >
                        {r.name || r.id} · {routeLengthM(r.points).toFixed(1)} м
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
            </>
          ) : null}
        </div>
      </div>

      {dxfPreview && (
        <div className="rounded border border-[rgba(245,193,74,0.4)] bg-[var(--nc-warning-soft)] p-4">
          <p className="text-sm font-semibold text-[var(--nc-warning)]">Импорт DXF — предварительный просмотр</p>
          <p className="mt-1 text-xs text-[var(--nc-warning)]">
            Линии не считаются стенами автоматически. Назначьте тип и масштаб, затем подтвердите.
          </p>
          <div className="mt-3 max-h-48 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--nc-muted)]">
                  <th className="py-1">Элемент чертежа</th>
                  <th>Слой</th>
                  <th>Назначить</th>
                </tr>
              </thead>
              <tbody>
                {dxfPreview.entities.slice(0, 40).map((e, idx) => (
                  <tr key={e.id} className="border-t border-amber-100">
                    <td className="py-1" title={`CAD: ${e.dxftype}`}>
                      {dxfEntityTypeLabel(e.dxftype)}
                      <span className="ml-1 text-[10px] text-[var(--nc-faint)]">({e.dxftype})</span>
                    </td>
                    <td>{e.layer || '—'}</td>
                    <td>
                      <select
                        className="rounded border border-[var(--nc-border-strong)] bg-[var(--nc-surface)] px-1 py-0.5"
                        value={e.kind || e.suggested_kind}
                        onChange={(ev) => {
                          const next = { ...dxfPreview, entities: [...dxfPreview.entities] }
                          next.entities[idx] = { ...e, kind: ev.target.value }
                          setDxfPreview(next)
                        }}
                      >
                        {KIND_OPTIONS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Input
              label="Масштаб: единиц чертежа → метры"
              value={unitToM}
              onChange={(e) => setUnitToM(e.target.value)}
              hint="мм→м: 0.001 · см→м: 0.01 · м→м: 1"
            />
            <Button
              data-testid="layout-dxf-confirm"
              loading={dxfConfirmMut.isPending}
              onClick={() => dxfConfirmMut.mutate()}
            >
              Применить импорт
            </Button>
            <Button variant="ghost" onClick={() => setDxfPreview(null)}>
              Отмена
            </Button>
          </div>
          {(dxfPreview.warnings || []).slice(0, 3).map((w) => (
            <p key={w} className="mt-1 text-xs text-[var(--nc-warning)]">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
