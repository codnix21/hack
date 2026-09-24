import { useEffect, useRef } from 'react'
import type { VisualizationLayout } from '../../types'
import type { LayerFlags, SimRobot, SimCollision } from '../../simulation/types'
import { STATUS_COLOR } from '../../simulation/types'
import { isoProject, roundRect, zoneFill } from './drawHelpers'

interface Props {
  layout: VisualizationLayout
  robots: SimRobot[]
  collisions: SimCollision[]
  layers: LayerFlags
  selectedRobotId: string | null
  onSelectRobot: (id: string | null) => void
}

export function WarehouseIsometric({
  layout,
  robots,
  collisions,
  layers,
  selectedRobotId,
  onSelectRobot,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = 860
    const h = 520
    canvas.width = w
    canvas.height = h

    const ox = w * 0.52
    const oy = h * 0.16
    const scale = Math.min(w / (layout.width || 800), h / (layout.height || 500)) * 0.92

    ctx.clearRect(0, 0, w, h)
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#eef1f4')
    bg.addColorStop(1, '#e2e6eb')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    const fw = (layout.width || 800) * scale
    const fh = (layout.height || 500) * scale
    const a = isoProject(0, 0, 0, ox, oy)
    const b = isoProject(fw, 0, 0, ox, oy)
    const c = isoProject(fw, fh, 0, ox, oy)
    const d = isoProject(0, fh, 0, ox, oy)

    // floor shadow
    ctx.fillStyle = 'rgba(20,23,28,0.08)'
    ctx.beginPath()
    ctx.moveTo(a.x + 6, a.y + 10)
    ctx.lineTo(b.x + 6, b.y + 10)
    ctx.lineTo(c.x + 6, c.y + 10)
    ctx.lineTo(d.x + 6, d.y + 10)
    ctx.closePath()
    ctx.fill()

    // floor
    ctx.fillStyle = '#d8dde4'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.lineTo(d.x, d.y)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#14171c'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // floor grid
    ctx.strokeStyle = 'rgba(100,116,139,0.22)'
    ctx.lineWidth = 1
    const step = 40 * scale
    for (let x = step; x < fw; x += step) {
      const p0 = isoProject(x, 0, 0, ox, oy)
      const p1 = isoProject(x, fh, 0, ox, oy)
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.stroke()
    }
    for (let y = step; y < fh; y += step) {
      const p0 = isoProject(0, y, 0, ox, oy)
      const p1 = isoProject(fw, y, 0, ox, oy)
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.stroke()
    }

    // painter's order: zones back-to-front
    const zones = [...(layout.zones || [])].sort(
      (z1, z2) => z1.x + z1.y + z1.w + z1.h - (z2.x + z2.y + z2.w + z2.h),
    )

    for (const z of zones) {
      const isShelf = (z.type || '') === 'storage'
      if (isShelf && !layers.shelves) continue
      if (!isShelf && !layers.zones) continue
      const elev = isShelf ? 32 : 4
      const x0 = z.x * scale
      const y0 = z.y * scale
      const ww = z.w * scale
      const dd = z.h * scale
      const color = isShelf ? '#9aafc2' : zoneFill(z.type, '#e8eaee')
      drawBox(ctx, ox, oy, x0, y0, ww, dd, elev, color, isShelf)
    }

    if (layers.routes) {
      for (const route of layout.routes || []) {
        if (!route.points?.length) continue
        const selected = robots.find((r) => r.id === selectedRobotId)?.routeId === route.id
        const dim = Boolean(selectedRobotId && !selected)
        ctx.strokeStyle = dim ? 'rgba(240,115,22,0.15)' : '#f07316'
        ctx.lineWidth = selected ? 2.75 : 1.75
        ctx.setLineDash(selected ? [] : [5, 4])
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        route.points.forEach((p, i) => {
          const pt = isoProject(p.x * scale, p.y * scale, 1.5, ox, oy)
          if (i === 0) ctx.moveTo(pt.x, pt.y)
          else ctx.lineTo(pt.x, pt.y)
        })
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    if (layers.zones) {
      for (const p of layout.charging_stations || []) {
        drawBox(ctx, ox, oy, p.x * scale - 10, p.y * scale - 10, 20, 20, 14, '#15803d', false)
        ctx.fillStyle = '#fff'
        ctx.font = '700 9px Barlow Condensed, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const top = isoProject(p.x * scale, p.y * scale, 14, ox, oy)
        ctx.fillText('ЗС', top.x, top.y)
        ctx.textAlign = 'start'
        ctx.textBaseline = 'alphabetic'
      }
      for (const p of layout.load_unload_points || []) {
        const load = (p.type || '').includes('load') && !(p.type || '').includes('unload')
        const pt = isoProject(p.x * scale, p.y * scale, 2, ox, oy)
        ctx.fillStyle = load ? '#c2410c' : '#1d4ed8'
        ctx.beginPath()
        ctx.moveTo(pt.x, pt.y - 7)
        ctx.lineTo(pt.x + 6, pt.y + 4)
        ctx.lineTo(pt.x - 6, pt.y + 4)
        ctx.closePath()
        ctx.fill()
      }
    }

    if (layers.collisions) {
      for (const col of collisions) {
        const pt = isoProject(col.x * scale, col.y * scale, 0, ox, oy)
        ctx.fillStyle = 'rgba(185,28,28,0.1)'
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(185,28,28,0.85)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 2])
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    if (layers.robots) {
      const sorted = [...robots].sort((r1, r2) => r1.x + r1.y - (r2.x + r2.y))
      for (const r of sorted) {
        const selected = r.id === selectedRobotId
        const base = isoProject(r.x * scale, r.y * scale, 0, ox, oy)
        const top = isoProject(r.x * scale, r.y * scale, 12, ox, oy)

        ctx.fillStyle = 'rgba(20,23,28,0.18)'
        ctx.beginPath()
        ctx.ellipse(base.x, base.y + 3, 11, 4.5, 0, 0, Math.PI * 2)
        ctx.fill()

        // oriented body hint via heading offset
        const hx = Math.cos(r.heading) * 4
        const hy = Math.sin(r.heading) * 2
        ctx.fillStyle = STATUS_COLOR[r.status]
        roundRect(ctx, top.x - 11 + hx * 0.2, top.y - 7 + hy * 0.2, 22, 14, 3)
        ctx.fill()

        // top plate
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        roundRect(ctx, top.x - 8, top.y - 5, 14, 7, 1)
        ctx.fill()

        if (selected) {
          ctx.strokeStyle = '#f07316'
          ctx.lineWidth = 2
          roundRect(ctx, top.x - 13, top.y - 9, 26, 18, 4)
          ctx.stroke()
        }

        if (r.cargoKg > 0) {
          ctx.fillStyle = '#eab308'
          roundRect(ctx, top.x - 6, top.y - 12, 12, 4, 1)
          ctx.fill()
        }

        // LED
        ctx.fillStyle = '#f07316'
        ctx.beginPath()
        ctx.arc(top.x - 7, top.y, 1.8, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#fff'
        ctx.font = '700 9px Barlow Condensed, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(r.label, top.x, top.y + 0.5)
        ctx.textAlign = 'start'
        ctx.textBaseline = 'alphabetic'
      }
    }
  }, [layout, robots, collisions, layers, selectedRobotId])

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !layers.robots) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY
    const w = 860
    const h = 520
    const ox = w * 0.52
    const oy = h * 0.16
    const scale = Math.min(w / (layout.width || 800), h / (layout.height || 500)) * 0.92
    let hit: string | null = null
    for (const r of robots) {
      const pt = isoProject(r.x * scale, r.y * scale, 12, ox, oy)
      if (Math.hypot(pt.x - mx, pt.y - my) < 18) {
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
      aria-label="Демонстрационная изометрия склада"
    />
  )
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  color: string,
  shelf: boolean,
) {
  const p = (px: number, py: number, pz: number) => isoProject(px, py, pz, ox, oy)
  const a = p(x, y, 0)
  const b = p(x + w, y, 0)
  const c = p(x + w, y + d, 0)
  const e = p(x, y, h)
  const f = p(x + w, y, h)
  const g = p(x + w, y + d, h)
  const i = p(x, y + d, h)

  // top
  ctx.fillStyle = shade(color, 18)
  ctx.beginPath()
  ctx.moveTo(e.x, e.y)
  ctx.lineTo(f.x, f.y)
  ctx.lineTo(g.x, g.y)
  ctx.lineTo(i.x, i.y)
  ctx.closePath()
  ctx.fill()

  // right
  ctx.fillStyle = shade(color, -22)
  ctx.beginPath()
  ctx.moveTo(f.x, f.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineTo(c.x, c.y)
  ctx.lineTo(g.x, g.y)
  ctx.closePath()
  ctx.fill()

  // left
  ctx.fillStyle = shade(color, -38)
  ctx.beginPath()
  ctx.moveTo(e.x, e.y)
  ctx.lineTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineTo(f.x, f.y)
  ctx.closePath()
  ctx.fill()

  if (shelf && h > 16) {
    ctx.strokeStyle = 'rgba(20,23,28,0.28)'
    ctx.lineWidth = 1
    const levels = 3
    for (let li = 1; li < levels; li++) {
      const zh = (h * li) / levels
      const le = p(x, y, zh)
      const lf = p(x + w, y, zh)
      const lg = p(x + w, y + d, zh)
      ctx.beginPath()
      ctx.moveTo(le.x, le.y)
      ctx.lineTo(lf.x, lf.y)
      ctx.lineTo(lg.x, lg.y)
      ctx.stroke()
    }
  }

  ctx.strokeStyle = 'rgba(20,23,28,0.28)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(e.x, e.y)
  ctx.lineTo(f.x, f.y)
  ctx.lineTo(g.x, g.y)
  ctx.lineTo(i.x, i.y)
  ctx.closePath()
  ctx.stroke()
}

function shade(hex: string, amount: number) {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return hex
  const n = parseInt(raw, 16)
  const r = Math.max(0, Math.min(255, (n >> 16) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount))
  return `rgb(${r},${g},${b})`
}
