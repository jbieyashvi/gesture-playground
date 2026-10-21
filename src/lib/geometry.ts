import type { Item, Vec2 } from './types'

export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)
export const angle = (a: Vec2, b: Vec2) => Math.atan2(b.y - a.y, b.x - a.x)
export const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function rotate(v: Vec2, rad: number): Vec2 {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
}

/** Shortest signed difference between two angles, in (-π, π]. */
export function angleDelta(from: number, to: number) {
  let d = to - from
  while (d > Math.PI) d -= 2 * Math.PI
  while (d <= -Math.PI) d += 2 * Math.PI
  return d
}

export const itemSize = (item: Item) => ({
  w: item.baseWidth * item.scale,
  h: item.baseWidth * item.aspect * item.scale,
})

/** Is `p` inside the item's rotated rectangle, grown by `margin` px on each side? */
export function hitItem(item: Item, p: Vec2, margin = 0) {
  const local = rotate({ x: p.x - item.x, y: p.y - item.y }, -item.rotation)
  const { w, h } = itemSize(item)
  return Math.abs(local.x) <= w / 2 + margin && Math.abs(local.y) <= h / 2 + margin
}

/** Topmost item under `p` (direct hits beat near-misses within `margin`). */
export function topItemAt(items: Item[], p: Vec2, margin = 0): Item | null {
  const byZ = [...items].sort((a, b) => b.z - a.z)
  return byZ.find((it) => hitItem(it, p)) ?? (margin > 0 ? byZ.find((it) => hitItem(it, p, margin)) : undefined) ?? null
}

/**
 * Maps a normalised landmark (from the raw, un-mirrored camera frame) to stage pixels,
 * matching a video shown with `object-fit: cover` and flipped horizontally.
 */
export function mapToStage(
  nx: number,
  ny: number,
  video: { w: number; h: number },
  stage: { w: number; h: number },
  mirrored = true,
): Vec2 {
  const s = Math.max(stage.w / video.w, stage.h / video.h)
  const dw = video.w * s
  const dh = video.h * s
  const x = mirrored ? 1 - nx : nx
  return { x: x * dw + (stage.w - dw) / 2, y: ny * dh + (stage.h - dh) / 2 }
}
