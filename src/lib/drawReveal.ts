import type { Mat, RevealState } from './reveal'

export interface RevealDrawOptions {
  /** The portrait (or its feathered copy), drawn at its natural pixel size. */
  img: HTMLImageElement | HTMLCanvasElement | null
  matrix: Mat | null
  opacity: number
  showLabels: boolean
  /** Calibration: show the whole aligned portrait, ignoring the window, plus your face targets. */
  fullPreview: boolean
}

const MONO = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace'
const LINE = 'rgba(255,255,255,0.55)'
const TICK = 'rgba(255,255,255,0.95)'
const WARN = 'rgba(255,184,107,0.95)'

/** A copy of the portrait whose edges fade out in an ellipse, so it blends into the webcam. */
export function featherPortrait(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  g.globalCompositeOperation = 'destination-in'
  g.setTransform(w / 2, 0, 0, h / 2, w / 2, h / 2) // unit circle → image-filling ellipse
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(0.68, 'rgba(0,0,0,1)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(-1, -1, 2, 2)
  return c
}

/** Expects the canvas already prepared by `beginFrame` (DPR transform set). */
export function drawReveal(ctx: CanvasRenderingContext2D, st: RevealState, o: RevealDrawOptions) {
  const dpr = window.devicePixelRatio || 1
  const win = st.window
  const canDrawFace = !!(o.img && o.matrix && st.face)

  // Portrait, clipped to the hand window (or unclipped while calibrating).
  if (canDrawFace && (o.fullPreview || (win && st.windowAlpha > 0))) {
    ctx.save()
    if (!o.fullPreview && win) {
      ctx.beginPath()
      ctx.roundRect(win.x, win.y, win.w, win.h, 4)
      ctx.clip()
    }
    const m = o.matrix!
    ctx.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, m[5] * dpr)
    ctx.globalAlpha = o.opacity * st.faceAlpha * (o.fullPreview ? 1 : st.windowAlpha)
    ctx.drawImage(o.img!, 0, 0)
    ctx.restore()
  }

  if (o.fullPreview && st.face) {
    // Where your eyes and mouth are — line the portrait markers up with these.
    ctx.save()
    ctx.fillStyle = 'rgba(94,227,177,0.95)'
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    for (const p of [st.face.leftEye, st.face.rightEye, st.face.mouth]) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  if (win && st.windowAlpha > 0) {
    ctx.save()
    ctx.globalAlpha = st.windowAlpha
    ctx.lineWidth = 1
    ctx.strokeStyle = LINE
    ctx.beginPath()
    ctx.roundRect(win.x + 0.5, win.y + 0.5, win.w - 1, win.h - 1, 4)
    ctx.stroke()
    brackets(ctx, win.x, win.y, win.w, win.h, Math.min(14, win.w / 4, win.h / 4), TICK)

    if (o.showLabels) {
      ctx.font = MONO
      ctx.textBaseline = 'bottom'
      label(ctx, `REVEAL ${Math.round(win.w)}×${Math.round(win.h)}`, win.x, win.y - 6, 'rgba(255,255,255,0.8)')
      ctx.textBaseline = 'top'
      const status = !st.face ? 'NO FACE' : !o.img ? 'NO PORTRAIT' : 'FACE LOCK'
      const tw = ctx.measureText(status).width
      label(ctx, status, win.x + win.w - tw, win.y + win.h + 6, st.face && o.img ? 'rgba(94,227,177,0.95)' : WARN)
    }
    ctx.restore()
  }

  // Small face tracking box, derived from the smoothed eyes so it doesn't jitter.
  if (o.showLabels && st.face) {
    const { leftEye: l, rightEye: r, mouth } = st.face
    const e = Math.hypot(r.x - l.x, r.y - l.y)
    const cx = (l.x + r.x + mouth.x) / 3
    const cy = (l.y + r.y + mouth.y) / 3
    const w = e * 2.3
    const h = e * 2.8
    ctx.save()
    ctx.globalAlpha = 0.7 * st.faceAlpha
    brackets(ctx, cx - w / 2, cy - h / 2, w, h, 8, 'rgba(255,255,255,0.7)')
    ctx.font = MONO
    ctx.textBaseline = 'bottom'
    const tilt = Math.round((Math.atan2(r.y - l.y, r.x - l.x) * 180) / Math.PI)
    label(ctx, `FACE ${tilt >= 0 ? '+' : ''}${tilt}°`, cx - w / 2, cy - h / 2 - 4, 'rgba(255,255,255,0.75)')
    ctx.restore()
  }
}

function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, len: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ]) {
    ctx.moveTo(cx + dx * len, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * len)
  }
  ctx.stroke()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 4
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.shadowBlur = 0
}
