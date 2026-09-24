import { useEffect, useRef } from 'react'
import type { VisualizationLayout } from '../../types'
import type { LayerFlags, SimRobot, SimCollision } from '../../simulation/types'
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
  onSelectRobot: (id: string | null) => void
  heatSamples?: { x: number; y: number }[]
}

export function Warehouse2D({
  layout,
  robots,
  collisions,
  layers,
  selectedRobotId,
  onSelectRobot,
  heatSamples = [],
}: Warehouse2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = layout.width || 800
    const h = layout.height || 500
    canvas.width = w
    canvas.height = h

    // floor
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#f4f5f7'
    ctx.fillRect(0, 0, w, h)

    // subtle grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)'
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
    ctx.strokeStyle = '#14171c'
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
      const isShelf = (z.type || '') === 'storage'
      if (isShelf && !layers.shelves) continue
      if (!isShelf && !layers.zones) continue
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

    if (layers.routes) {
      for (const route of layout.routes || []) {
        if (!route.points?.length) continue
        const selectedRoute = robots.find((r) => r.id === selectedRobotId)?.routeId === route.id
        const dim = selectedRobotId && !selectedRoute

        // soft lane
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.strokeStyle = dim ? 'rgba(51,65,85,0.05)' : 'rgba(51,65,85,0.1)'
        ctx.lineWidth = 16
        ctx.beginPath()
        ctx.moveTo(route.points[0].x, route.points[0].y)
        route.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
        ctx.stroke()

        // route path
        ctx.strokeStyle = dim ? 'rgba(240,115,22,0.18)' : '#f07316'
        ctx.lineWidth = selectedRoute ? 3 : 2
        ctx.setLineDash(selectedRoute ? [] : [8, 6])
        ctx.beginPath()
        ctx.moveTo(route.points[0].x, route.points[0].y)
        route.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
        ctx.stroke()
        ctx.setLineDash([])

        if (layers.directions && !dim) {
          for (let i = 1; i < route.points.length; i += 2) {
            const a = route.points[i - 1]
            const b = route.points[i]
            const ang = Math.atan2(b.y - a.y, b.x - a.x)
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            ctx.save()
            ctx.translate(mx, my)
            ctx.rotate(ang)
            ctx.fillStyle = selectedRoute ? '#d45a0a' : '#f07316'
            ctx.beginPath()
            ctx.moveTo(7, 0)
            ctx.lineTo(-4, -4)
            ctx.lineTo(-4, 4)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
          }
        }
      }
    }

    if (layers.zones) {
      for (const p of layout.charging_stations || []) {
        const cx = Math.max(22, Math.min(w - 22, p.x))
        const cy = Math.max(22, Math.min(h - 22, p.y))
        ctx.fillStyle = '#15803d'
        roundRect(ctx, cx - 16, cy - 10, 32, 20, 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        roundRect(ctx, cx - 16, cy - 10, 32, 7, 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = '700 10px Barlow Condensed, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('ЗС', cx, cy + 1)
      }
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
  }, [layout, robots, collisions, layers, selectedRobotId, heatSamples])

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
      className="mx-auto block max-w-full cursor-pointer rounded-sm shadow-sm ring-1 ring-steel-200/80"
      onClick={onClick}
      role="img"
      aria-label="Демонстрационный план склада 2D"
    />
  )
}
