import { describe, expect, it } from 'vitest'
import { PREVIEW, itemBounds, previewLayout, previewTitle } from './preview'
import type { Item } from './types'

const item = (x: number, y: number, extra: Partial<Item> = {}): Item => ({
  id: 'a', src: '', name: 'Dashboard', baseWidth: 200, aspect: 0.5, x, y, scale: 1, rotation: 0, z: 1, ...extra,
})
const desktop = { w: 1280, h: 720 }
const inside = (l: { x: number; y: number; w: number; h: number }, v: { w: number; h: number }) =>
  l.x >= PREVIEW.margin - 0.01 && l.y >= PREVIEW.margin - 0.01 && l.x + l.w <= v.w - PREVIEW.margin + 0.01 && l.y + l.h <= v.h + 0.01

describe('previewLayout', () => {
  it('sits to the right of the image on desktop, vertically centred, 300px wide', () => {
    const l = previewLayout(item(400, 360), desktop)
    expect(l.side).toBe('right')
    expect(l.w).toBe(300)
    expect(l.x).toBe(400 + 100 + PREVIEW.gap)
    expect(l.y + l.h / 2).toBeCloseTo(360)
  })

  it('flips to the left near the right edge', () => {
    const l = previewLayout(item(1150, 360), desktop)
    expect(l.side).toBe('left')
    expect(l.x + l.w).toBe(1150 - 100 - PREVIEW.gap)
  })

  it('goes below or above when neither side has room (phones)', () => {
    const phone = { w: 390, h: 844 }
    const l = previewLayout(item(195, 250, { baseWidth: 300 }), phone)
    expect(l.side).toBe('below')
    expect(l.w).toBe(280)
    expect(inside(l, phone)).toBe(true)
  })

  it('stays inside the viewport and clear of the toolbar', () => {
    const l = previewLayout(item(400, 700), desktop, 80)
    expect(inside(l, desktop)).toBe(true)
    expect(l.y + l.h).toBeLessThanOrEqual(desktop.h - 80)
  })

  it('shows the whole image at its original proportions, capped in height', () => {
    const wide = previewLayout(item(400, 360), desktop)
    expect(wide.imgH / wide.imgW).toBeCloseTo(0.5)
    expect(wide.imgW).toBe(300 - 2 * PREVIEW.pad)
    const tall = previewLayout(item(400, 360, { aspect: 2 }), desktop)
    expect(tall.imgH).toBeLessThanOrEqual(PREVIEW.maxImgH)
    expect(tall.imgH / tall.imgW).toBeCloseTo(2)
  })

  it('accounts for rotation when placing beside the image', () => {
    const b = itemBounds(item(400, 360, { rotation: Math.PI / 2 }))
    expect(b.w).toBeCloseTo(100)
    expect(previewLayout(item(400, 360, { rotation: Math.PI / 2 }), desktop).x).toBeCloseTo(400 + 50 + PREVIEW.gap)
  })
})

describe('previewTitle', () => {
  it('uses the existing name, minus a file extension, or a neutral label', () => {
    expect(previewTitle(item(0, 0), 0)).toBe('Dashboard')
    expect(previewTitle(item(0, 0, { name: 'holiday-2024.JPG' }), 0)).toBe('holiday-2024')
    expect(previewTitle(item(0, 0, { name: '.png' }), 2)).toBe('Image 3')
  })
})
