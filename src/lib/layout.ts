import type { Item } from './types'

/** Long side of a freshly placed image, in px. */
const TARGET = 240

export function baseWidthFor(aspect: number, stageW: number) {
  const target = Math.min(TARGET, Math.max(140, stageW * 0.2))
  return aspect > 1 ? target / aspect : target
}

let counter = 0
export const newId = () => `img-${Date.now().toString(36)}-${(counter++).toString(36)}`

/** Tidy grid, centred on the stage, upright and at scale 1. Preserves stacking order. */
export function gridLayout(items: Item[], stage: { w: number; h: number }): Item[] {
  if (!items.length) return items
  const ordered = [...items].sort((a, b) => a.z - b.z)
  const cols = Math.min(ordered.length, Math.max(1, Math.floor(stage.w / 300)))
  const rows = Math.ceil(ordered.length / cols)
  const cellW = Math.min(300, stage.w / cols)
  const cellH = Math.min(320, (stage.h - 120) / rows)
  const x0 = stage.w / 2 - (cols * cellW) / 2 + cellW / 2
  const y0 = stage.h / 2 - (rows * cellH) / 2 + cellH / 2
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
