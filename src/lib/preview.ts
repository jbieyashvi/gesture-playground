import { itemSize, rotate } from './geometry'
import type { Item, Rect } from './types'

export const PREVIEW = {
  /** Card width on desktop; phones get `viewport − 2 × gutter`, capped at `mobileWidth`. */
  width: 300,
  mobileWidth: 280,
  mobileBreakpoint: 640,
  gutter: 16,
  pad: 8,
  /** Height of the title row under the image. */
  titleH: 36,
  maxImgH: 360,
  /** Space between the image and the card. */
  gap: 14,
  /** Minimum distance from the viewport edges. */
  margin: 12,
}

export type PreviewSide = 'right' | 'left' | 'below' | 'above'

export interface PreviewLayout extends Rect {
  side: PreviewSide
  imgW: number
  imgH: number
}

/** Screen-space bounding box of a (possibly rotated) item. */
export function itemBounds(item: Item): Rect {
  const { w, h } = itemSize(item)
  const corners = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ].map((c) => rotate(c, item.rotation))
  const xs = corners.map((c) => c.x + item.x)
  const ys = corners.map((c) => c.y + item.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/**
 * Where to put the compact preview card for `item`: beside it (right, then left), else below or above,
 * always clamped inside the viewport. `reserveBottom` keeps it clear of the toolbar.
 */
export function previewLayout(item: Item, viewport: { w: number; h: number }, reserveBottom = 0): PreviewLayout {
  const P = PREVIEW
  const w =
    viewport.w < P.mobileBreakpoint ? Math.min(P.mobileWidth, viewport.w - 2 * P.gutter) : Math.min(P.width, viewport.w - 2 * P.gutter)
  const top = P.margin
  const bottom = viewport.h - Math.max(P.margin, reserveBottom)
  const left = P.margin
  const right = viewport.w - P.margin

  // Whole image, original proportions: fit the inner width, shrink if it would be too tall.
  const aspect = item.aspect
  const inner = w - 2 * P.pad
  const maxImgH = Math.max(60, Math.min(P.maxImgH, viewport.h * 0.55, bottom - top - 2 * P.pad - P.titleH))
  const imgH = Math.min(inner * aspect, maxImgH)
  const imgW = imgH / aspect
  const h = P.pad + imgH + P.titleH

  const b = itemBounds(item)
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const candidates: { side: PreviewSide; x: number; y: number; room: number }[] = [
    { side: 'right', x: b.x + b.w + P.gap, y: cy - h / 2, room: right - (b.x + b.w + P.gap) - w },
    { side: 'left', x: b.x - P.gap - w, y: cy - h / 2, room: b.x - P.gap - w - left },
    { side: 'below', x: cx - w / 2, y: b.y + b.h + P.gap, room: bottom - (b.y + b.h + P.gap) - h },
    { side: 'above', x: cx - w / 2, y: b.y - P.gap - h, room: b.y - P.gap - h - top },
  ]
  const pick = candidates.find((c) => c.room >= 0) ?? candidates.reduce((a, c) => (c.room > a.room ? c : a))
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))
  return {
    side: pick.side,
    x: clamp(pick.x, left, right - w),
    y: clamp(pick.y, top, bottom - h),
    w,
    h,
    imgW,
    imgH,
  }
}

/** A short title: the image's own name without a file extension, or a neutral fallback. */
export function previewTitle(item: Item, index: number) {
  const name = item.name.replace(/\.(jpe?g|png|webp)$/i, '').trim()
  return name || `Image ${index + 1}`
}
