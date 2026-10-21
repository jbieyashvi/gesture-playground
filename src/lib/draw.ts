import type { HandFrame, HandStatus } from './types'

type Connection = { start: number; end: number }

/** Sizes the canvas for the current DPR and clears it. */
export function beginFrame(ctx: CanvasRenderingContext2D, size: { w: number; h: number }) {
  const dpr = window.devicePixelRatio || 1
  const { canvas } = ctx
  if (canvas.width !== Math.round(size.w * dpr) || canvas.height !== Math.round(size.h * dpr)) {
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size.w, size.h)
}

/** Draws subtle hand landmarks plus a pinch cursor per hand. Pass `clear: false` to draw over an earlier layer. */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number },
  frames: HandFrame[],
  statuses: HandStatus[],
  connections: Connection[],
  showLandmarks: boolean,
  clear = true,
) {
  if (clear) beginFrame(ctx, size)

  if (showLandmarks) {
    for (const f of frames) {
      if (f.points.length < 21) continue
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'
      ctx.lineWidth = 1.25
      ctx.beginPath()
      for (const { start, end } of connections) {
        ctx.moveTo(f.points[start].x, f.points[start].y)
        ctx.lineTo(f.points[end].x, f.points[end].y)
      }
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      for (const p of f.points) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // Pinch cursors stay visible even with landmarks hidden — they're the interaction feedback.
  for (const s of statuses) {
    const holding = s.phase === 'dragging' || s.phase === 'resizing'
    ctx.globalAlpha = s.lost ? 0.35 : 1
    ctx.lineWidth = 1.5
    ctx.strokeStyle = holding ? 'rgba(140,170,255,0.95)' : 'rgba(255,255,255,0.75)'
    ctx.fillStyle = holding ? 'rgba(140,170,255,0.35)' : s.pinched ? 'rgba(255,255,255,0.25)' : 'transparent'
    // Open hand: aim with the index fingertip. Pinched: sit between thumb and index.
    const c = s.pinched ? s.pinch : s.tip
    ctx.beginPath()
    ctx.arc(c.x, c.y, s.pinched ? 7 : 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}
