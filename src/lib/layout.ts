import type { Item, Rect } from './types'

/** The side text takes a left column on wide screens and a band above the gallery on narrow ones (see `.intro` CSS). */
export const INTRO = { breakpoint: 900, sideW: 320, topH: 190 }

/** The part of the stage the gallery is laid out in, leaving room for the side text. */
export function galleryRegion(stage: { w: number; h: number }): Rect {
  return stage.w >= INTRO.breakpoint
    ? { x: INTRO.sideW, y: 0, w: stage.w - INTRO.sideW, h: stage.h }
    : { x: 0, y: INTRO.topH, w: stage.w, h: stage.h - INTRO.topH }
}

/** Long side of a freshly placed image, in px. */
const TARGET = 240

export function baseWidthFor(aspect: number, stageW: number) {
  const target = Math.min(TARGET, Math.max(140, stageW * 0.2))
  return aspect > 1 ? target / aspect : target
}

let counter = 0
export const newId = () => `img-${Date.now().toString(36)}-${(counter++).toString(36)}`

/** Tidy grid, centred in `region` (default: the whole stage), upright and at scale 1. Preserves stacking order. */
export function gridLayout(items: Item[], stage: { w: number; h: number }, region: Rect = { x: 0, y: 0, ...stage }): Item[] {
  if (!items.length) return items
  const ordered = [...items].sort((a, b) => a.z - b.z)
  const cols = Math.min(ordered.length, Math.max(1, Math.floor(region.w / 300)))
  const rows = Math.ceil(ordered.length / cols)
  const cellW = Math.min(300, region.w / cols)
  // Keep clear of the toolbar at the bottom.
  const usableH = region.h - Math.max(0, region.y + region.h - (stage.h - 80)) - 40
  const cellH = Math.min(320, usableH / rows)
  const x0 = region.x + region.w / 2 - (cols * cellW) / 2 + cellW / 2
  const y0 = region.y + 20 + usableH / 2 - (rows * cellH) / 2 + cellH / 2
  const placed = new Map(
    ordered.map((it, i) => {
      const baseWidth = baseWidthFor(it.aspect, stage.w)
      const fit = Math.min(1, (cellW - 24) / baseWidth, (cellH - 24) / (baseWidth * it.aspect))
      return [
        it.id,
        { ...it, baseWidth, scale: fit, rotation: 0, z: i + 1, x: x0 + (i % cols) * cellW, y: y0 + Math.floor(i / cols) * cellH },
      ]
    }),
  )
  return items.map((it) => placed.get(it.id)!)
}
