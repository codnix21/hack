import { useEffect, useRef } from 'react'
import type { VisualizationLayout } from '../../types'
import type { LayerFlags, SimRobot, SimCollision } from '../../simulation/types'
import { pointAlongPolyline } from '../../simulation/pathMath'
import { useThemeStore } from '../../store/themeStore'
import { readCanvasColors } from '../../utils/chartTheme'
import {
  drawAmrBody,
  drawStatusPill,
  drawStorageRack,
  drawZoneLabel,
  roundRect,
  zoneFill,
  zoneStroke,
} from './drawHelpers'

interface Warehouse2DProps {
  layout: VisualizationLayout
  robots: SimRobot[]
  collisions: SimCollision[]
  layers: LayerFlags
  selectedRobotId: string | null
  selectedRouteId?: string | null
  onSelectRobot: (id: string | null) => void
  heatSamples?: { x: number; y: number }[]
}

export function Warehouse2D({
  layout,
  robots,
  collisions,
  layers,
  selectedRobotId,
  selectedRouteId = null,
  onSelectRobot,
  heatSamples = [],
}: Warehouse2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = layout.width || 800
    const h = layout.height || 500
    canvas.width = w
    canvas.height = h
    const colors = readCanvasColors()

    // floor — theme-aware industrial canvas
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = colors.floor
    ctx.fillRect(0, 0, w, h)

    // grid
    ctx.strokeStyle = colors.grid
    ctx.lineWidth = 1
    for (let x = 0; x <= w; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, h)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(w, y + 0.5)
      ctx.stroke()
    }

    // frame
    ctx.strokeStyle = colors.frame
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, w - 2, h - 2)

    if (layers.heatmap && heatSamples.length) {
      for (const p of heatSamples) {
        const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 32)
        g.addColorStop(0, 'rgba(240, 115, 22, 0.32)')
        g.addColorStop(1, 'rgba(240, 115, 22, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, 32, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const zones = [...(layout.zones || [])].sort((a, b) => {
      const rank = (t?: string) =>
        t === 'aisle' || t === 'corridor' ? 0 : t === 'storage' ? 2 : 1
      return rank(a.type) - rank(b.type)
    })

    for (const z of zones) {
      const t = (z.type || '').toLowerCase()
      const isShelf = t === 'storage'
      const isWall = t === 'wall'
      if (isShelf && !layers.shelves) continue
      if (!isShelf && !layers.zones) continue
      if (isWall) {
        // контур склада рисуется через layout.walls
        continue
      }
      const rot = ((z.rotation || 0) * Math.PI) / 180
      if (rot) {
        const cx = z.x + z.w / 2
        const cy = z.y + z.h / 2
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rot)
        if (isShelf) {
          drawStorageRack(ctx, -z.w / 2, -z.h / 2, z.w, z.h, z.name)
        } else {
          ctx.fillStyle = zoneFill(z.type, z.color)
          roundRect(ctx, -z.w / 2, -z.h / 2, z.w, z.h, 2)
          ctx.fill()
          ctx.strokeStyle = zoneStroke(z.type)
          ctx.lineWidth = 1.25
          ctx.stroke()
          drawZoneLabel(ctx, z.name, -z.w / 2, -z.h / 2, z.w, z.h)
        }
        ctx.restore()
        continue
      }
      if (isShelf) {
        drawStorageRack(ctx, z.x, z.y, z.w, z.h, z.name)
        continue
      }
      ctx.fillStyle = zoneFill(z.type, z.color)
      roundRect(ctx, z.x, z.y, z.w, z.h, 2)
      ctx.fill()
      ctx.strokeStyle = zoneStroke(z.type)
      ctx.lineWidth = 1.25
      ctx.stroke()
      drawZoneLabel(ctx, z.name, z.x, z.y, z.w, z.h)
    }

    const hasZoneType = (pred: (t: string) => boolean) =>
      (layout.zones || []).some((z) => pred((z.type || '').toLowerCase()))

    if (layers.routes) {
      // заблокированные — тонкая красная пунктирная (не «успешный» оранжевый)
      for (const route of layout.routes || []) {
        if (!route.blocked || !route.points?.length) continue
        ctx.strokeStyle = 'rgba(185, 28, 28, 0.55)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 5])
        ctx.beginPath()
        ctx.moveTo(route.points[0].x, route.points[0].y)
        route.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
        ctx.stroke()
        ctx.setLineDash([])
      }

      for (const route of layout.routes || []) {
        if (!route.points?.length || route.blocked) continue
        const owner = robots.find((r) => r.routeId === route.id)
        const selectedRoute =
          route.id === selectedRouteId ||
          (selectedRobotId != null && owner?.id === selectedRobotId)
        const dim = Boolean((selectedRobotId || selectedRouteId) && !selectedRoute)

        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        // planned (dim or full)
        ctx.strokeStyle = dim ? 'rgba(100, 116, 139, 0.22)' : 'rgba(240, 115, 22, 0.35)'
        ctx.lineWidth = selectedRoute ? 2.5 : 1.5
        ctx.setLineDash(selectedRoute ? [] : [7, 5])
        ctx.beginPath()
        ctx.moveTo(route.points[0].x, route.points[0].y)
        route.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
        ctx.stroke()
        ctx.setLineDash([])

        // traveled segment for selected robot on this route
        if (selectedRoute && owner && owner.routeDistPx > 0) {
          const along = pointAlongPolyline(route.points, owner.routeDistPx)
          ctx.strokeStyle = '#c2410c'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(route.points[0].x, route.points[0].y)
          let acc = 0
          for (let i = 1; i < route.points.length; i++) {
            const a = route.points[i - 1]
            const b = route.points[i]
            const seg = Math.hypot(b.x - a.x, b.y - a.y)
            if (acc + seg >= owner.routeDistPx) {
              ctx.lineTo(along.x, along.y)
              break
            }
            ctx.lineTo(b.x, b.y)
            acc += seg
          }
          ctx.stroke()
        }

        if (layers.directions && !dim) {
          const step = selectedRoute ? 1 : 2
          for (let i = 1; i < route.points.length; i += step) {
            const a = route.points[i - 1]
            const b = route.points[i]
            const ang = Math.atan2(b.y - a.y, b.x - a.x)
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            ctx.save()
            ctx.translate(mx, my)
            ctx.rotate(ang)
            ctx.fillStyle = selectedRoute ? '#9a3412' : 'rgba(240,115,22,0.7)'
            ctx.beginPath()
            ctx.moveTo(6, 0)
            ctx.lineTo(-3.5, -3.5)
            ctx.lineTo(-3.5, 3.5)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
          }
        }

        // destination marker for selected route
        if (selectedRoute) {
          const last = route.points[route.points.length - 1]
          ctx.fillStyle = '#ea580c'
          ctx.beginPath()
          ctx.arc(last.x, last.y, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
    }

    // Точечные маркеры — только если зоны-прямоугольники ещё не пришли из сохранённого плана
    if (layers.zones && !hasZoneType((t) => t === 'charge' || t === 'charging')) {
      for (const p of layout.charging_stations || []) {
        const cx = Math.max(22, Math.min(w - 22, p.x))
        const cy = Math.max(22, Math.min(h - 22, p.y))
        ctx.fillStyle = '#15803d'
        roundRect(ctx, cx - 16, cy - 10, 32, 20, 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = '700 10px Segoe UI, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('ЗС', cx, cy + 1)
      }
    }
    if (layers.zones && !hasZoneType((t) => t === 'load' || t === 'unload')) {
      for (const p of layout.load_unload_points || []) {
        const load = (p.type || '').includes('load') && !(p.type || '').includes('unload')
        const cx = Math.max(12, Math.min(w - 12, p.x))
        const cy = Math.max(20, Math.min(h - 12, p.y))
        ctx.fillStyle = load ? '#c2410c' : '#1d4ed8'
        ctx.beginPath()
        ctx.moveTo(cx, cy - 8)
        ctx.lineTo(cx + 7, cy + 5)
        ctx.lineTo(cx - 7, cy + 5)
        ctx.closePath()
        ctx.fill()
      }
    }

    if (layers.collisions) {
      for (const c of collisions) {
        ctx.fillStyle = 'rgba(185, 28, 28, 0.08)'
        ctx.beginPath()
        ctx.arc(c.x, c.y, 24, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(185, 28, 28, 0.85)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.arc(c.x, c.y, 22, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    if (layers.robots) {
      for (const r of robots) {
        const selected = r.id === selectedRobotId
        const rx = Math.max(18, Math.min(w - 18, r.x))
        const ry = Math.max(18, Math.min(h - 22, r.y))

        ctx.fillStyle = 'rgba(20, 23, 28, 0.14)'
        ctx.beginPath()
        ctx.ellipse(rx + 1, ry + 9, 13, 4.5, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.save()
        ctx.translate(rx, ry)
        ctx.rotate(r.heading)
        drawAmrBody(ctx, {
          status: r.status,
          label: r.label,
          selected,
          cargoKg: r.cargoKg,
        })
        ctx.restore()

        // status caption only for selected — keeps scene readable
        if (selected) {
          drawStatusPill(ctx, r.status, rx, ry, w, h)
        }
      }
    }
  }, [layout, robots, collisions, layers, selectedRobotId, selectedRouteId, heatSamples, theme])

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !layers.robots) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    let hit: string | null = null
    for (const r of robots) {
      if (Math.hypot(r.x - x, r.y - y) < 22) {
        hit = r.id
        break
      }
    }
    onSelectRobot(hit)
  }

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto block max-w-full cursor-pointer rounded-sm shadow-sm ring-1 ring-[var(--nc-border)]"
      onClick={onClick}
      role="img"
      aria-label="План склада 2D"
    />
  )
}
