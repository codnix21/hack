import type { RobotStatusCode } from '../../simulation/types'
import { STATUS_COLOR, STATUS_SHORT_RU } from '../../simulation/types'

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function zoneFill(type?: string, fallback?: string) {
  switch ((type || '').toLowerCase()) {
    case 'storage':
      return '#d5dde8'
    case 'load':
      return '#ffedd5'
    case 'unload':
      return '#dbeafe'
    case 'aisle':
    case 'corridor':
      return '#f1f3f6'
    case 'service':
      return '#dcfce7'
    case 'ward':
    case 'terminal':
      return '#e0e7ff'
    case 'baggage':
      return '#fef3c7'
    case 'cargo':
      return '#d1fae5'
    default:
      return fallback || '#eef0f3'
  }
}

export function zoneStroke(type?: string) {
  switch ((type || '').toLowerCase()) {
    case 'load':
      return '#c2410c'
    case 'unload':
      return '#1d4ed8'
    case 'storage':
      return '#475569'
    case 'aisle':
    case 'corridor':
      return '#cbd5e1'
    case 'service':
      return '#15803d'
    default:
      return '#94a3b8'
  }
}

export function fitLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
    t = t.slice(0, -1)
  }
  return t.length < text.length ? `${t}…` : t
}

export function drawZoneLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  zx: number,
  zy: number,
  zw: number,
  zh: number,
  opts?: { vertical?: boolean },
) {
  const pad = 4
  if (zw < 14 || zh < 14) return
  const vertical = opts?.vertical ?? (zw < 70 && zh > zw * 1.4)
  ctx.font = vertical
    ? '700 12px Barlow Condensed, Segoe UI, sans-serif'
    : '600 11px Barlow, Segoe UI, sans-serif'

  if (vertical) {
    const label = text.length <= 4 ? text : text.slice(0, 3)
    ctx.save()
    ctx.translate(zx + zw / 2, zy + zh / 2)
    ctx.rotate(-Math.PI / 2)
    const tw = ctx.measureText(label).width
    const bw = tw + 10
    const bh = 16
    ctx.fillStyle = 'rgba(255,255,255,0.94)'
    roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 2)
    ctx.fill()
    ctx.fillStyle = '#1c1f26'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 0, 0.5)
    ctx.restore()
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
    return
  }

  const label = fitLabel(ctx, text, Math.max(20, zw - pad * 2 - 8))
  const tw = ctx.measureText(label).width
  const bw = Math.min(tw + 10, zw - pad * 2)
  const bh = 15
  if (bh + pad * 2 > zh) return
  const bx = zx + (zw - bw) / 2
  const by = zy + pad
  ctx.fillStyle = 'rgba(255,255,255,0.94)'
  roundRect(ctx, bx, by, bw, bh, 2)
  ctx.fill()
  ctx.fillStyle = '#1c1f26'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, bx + bw / 2, by + bh / 2 + 0.5)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

export function drawStorageRack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
) {
  // base plate
  ctx.fillStyle = '#b8c5d4'
  roundRect(ctx, x, y, w, h, 2)
  ctx.fill()

  // inner face
  ctx.fillStyle = '#c9d4e0'
  roundRect(ctx, x + 2, y + 2, Math.max(1, w - 4), Math.max(1, h - 4), 1)
  ctx.fill()

  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1.25
  roundRect(ctx, x, y, w, h, 2)
  ctx.stroke()

  const bays = Math.max(3, Math.min(8, Math.floor(h / 26)))
  const bayH = h / bays
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)'
  ctx.lineWidth = 1
  for (let i = 1; i < bays; i++) {
    const yy = y + i * bayH
    ctx.beginPath()
    ctx.moveTo(x + 3, yy)
    ctx.lineTo(x + w - 3, yy)
    ctx.stroke()
    // subtle cargo blocks
    if (i % 2 === 0 && w > 28) {
      ctx.fillStyle = 'rgba(100, 116, 139, 0.18)'
      roundRect(ctx, x + 5, yy - bayH + 4, w - 10, bayH - 8, 1)
      ctx.fill()
    }
  }
  const posts = Math.max(2, Math.min(4, Math.floor(w / 36)))
  for (let i = 1; i < posts; i++) {
    const xx = x + (w * i) / posts
    ctx.beginPath()
    ctx.moveTo(xx, y + 2)
    ctx.lineTo(xx, y + h - 2)
    ctx.stroke()
  }
  drawZoneLabel(ctx, name, x, y, w, h, { vertical: true })
}

/** Stylized AMR body at origin, facing +X. Caller applies translate/rotate. */
export function drawAmrBody(
  ctx: CanvasRenderingContext2D,
  opts: {
    status: RobotStatusCode
    label: string
    selected?: boolean
    cargoKg?: number
  },
) {
  const { status, label, selected, cargoKg = 0 } = opts
  const body = STATUS_COLOR[status]

  // shadow handled by caller usually; soft undercarriage
  ctx.fillStyle = '#0f1217'
  roundRect(ctx, -13, 5, 8, 4, 1)
  ctx.fill()
  roundRect(ctx, 5, 5, 8, 4, 1)
  ctx.fill()

  // chassis
  ctx.fillStyle = body
  roundRect(ctx, -15, -9, 30, 18, 4)
  ctx.fill()

  // top plate
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, -12, -7, 22, 10, 2)
  ctx.fill()

  // status LED
  ctx.fillStyle = status === 'ERROR' ? '#fecaca' : '#f07316'
  ctx.beginPath()
  ctx.arc(-10, 0, 2.2, 0, Math.PI * 2)
  ctx.fill()

  // heading chevron
  ctx.fillStyle = '#f07316'
  ctx.beginPath()
  ctx.moveTo(16, 0)
  ctx.lineTo(8, -5)
  ctx.lineTo(8, 5)
  ctx.closePath()
  ctx.fill()

  if (cargoKg > 0) {
    ctx.fillStyle = '#eab308'
    roundRect(ctx, -7, -15, 14, 5, 1)
    ctx.fill()
    ctx.strokeStyle = 'rgba(20,23,28,0.25)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  if (selected) {
    ctx.strokeStyle = '#f07316'
    ctx.lineWidth = 2.5
    roundRect(ctx, -17, -11, 34, 22, 5)
    ctx.stroke()
  }

  ctx.fillStyle = '#fff'
  ctx.font = '700 10px Barlow Condensed, Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 0, 0.5)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

export function drawStatusPill(
  ctx: CanvasRenderingContext2D,
  status: RobotStatusCode,
  x: number,
  y: number,
  canvasW: number,
  canvasH: number,
) {
  const text = STATUS_SHORT_RU[status]
  ctx.font = '600 9px Barlow, Segoe UI, sans-serif'
  const tw = ctx.measureText(text).width
  const bw = tw + 10
  const bh = 13
  let bx = x - bw / 2
  let by = y + 15
  bx = Math.max(4, Math.min(canvasW - bw - 4, bx))
  by = Math.max(4, Math.min(canvasH - bh - 4, by))
  ctx.fillStyle = 'rgba(20, 23, 28, 0.88)'
  roundRect(ctx, bx, by, bw, bh, 2)
  ctx.fill()
  ctx.fillStyle = STATUS_COLOR[status]
  ctx.beginPath()
  ctx.arc(bx + 6, by + bh / 2, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f8fafc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + bw / 2 + 3, by + bh / 2 + 0.5)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

/** Изометрическая проекция: floor (x,y) → screen */
export function isoProject(x: number, y: number, z = 0, ox = 0, oy = 0) {
  const s = 0.55
  return {
    x: ox + (x - y) * s,
    y: oy + (x + y) * s * 0.5 - z,
  }
}
