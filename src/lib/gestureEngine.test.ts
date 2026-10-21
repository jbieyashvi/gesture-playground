import { describe, expect, it } from 'vitest'
import { GestureEngine } from './gestureEngine'
import { mapToStage } from './geometry'
import type { HandFrame, Item, Vec2 } from './types'

const OPEN = 1.0
const PINCH = 0.1

const item = (id: string, x: number, y: number, z = 1): Item => ({
  id, src: '', name: id, baseWidth: 200, aspect: 0.5, x, y, scale: 1, rotation: 0, z,
})

const hand = (pinch: Vec2, ratio: number, key = 'Right'): HandFrame => ({ key, pinch, pinchRatio: ratio, points: [] })

/** Run frames at 60fps, feeding the engine's output back in. */
function run(engine: GestureEngine, items: Item[], frames: HandFrame[][], t0 = 0) {
  let cur = items
  let t = t0
  let last = { items: cur, changed: false, hands: [], selectedId: null, taps: [] } as ReturnType<GestureEngine['step']>
  for (const f of frames) {
    t += 16
    last = engine.step(f, t, cur)
    cur = last.items
  }
  return { items: cur, last, t }
}

const repeat = <T,>(n: number, fn: (i: number) => T) => Array.from({ length: n }, (_, i) => fn(i))
const lerp = (a: Vec2, b: Vec2, k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })
/** Hands move continuously in reality — glide from a to b over n frames. */
const glide = (a: Vec2, b: Vec2, n: number) => repeat(n, (i) => lerp(a, b, (i + 1) / n))
const open = (p: Vec2, n = 4, key?: string) => repeat(n, () => [hand(p, OPEN, key)])

describe('GestureEngine', () => {
  it('grabs on pinch, drags, and drops on release', () => {
    const e = new GestureEngine()
    const p = { x: 300, y: 300 }
    let { items, last } = run(e, [item('a', 300, 300)], [
      ...repeat(5, () => [hand(p, OPEN)]),
      ...repeat(5, () => [hand(p, PINCH)]),
    ])
    expect(last.hands[0].phase).toBe('dragging')
    // Move 100px right over many frames; smoothing should converge.
    ;({ items, last } = run(e, items, [...glide(p, { x: 400, y: 300 }, 10).map((q) => [hand(q, PINCH)]), ...repeat(60, () => [hand({ x: 400, y: 300 }, PINCH)])], 1000))
    expect(items[0].x).toBeCloseTo(400, 0)
    ;({ items, last } = run(e, items, repeat(6, () => [hand({ x: 400, y: 300 }, OPEN)]), 3000))
    expect(last.hands[0].phase).toBe('open')
    const dropped = items[0].x
    ;({ items } = run(e, items, repeat(30, () => [hand({ x: 600, y: 300 }, OPEN)]), 4000))
    expect(items[0].x).toBe(dropped)
  })

  it('does not drop inside the hysteresis band (no accidental release)', () => {
    const e = new GestureEngine()
    const p = { x: 300, y: 300 }
    const { last } = run(e, [item('a', 300, 300)], [
      ...open(p),
      ...repeat(5, () => [hand(p, PINCH)]),
      ...repeat(20, () => [hand(p, 0.42)]), // between grab (0.3) and release (0.5)
    ])
    expect(last.hands[0].phase).toBe('dragging')
  })

  it('ignores a single noisy open frame while pinching (debounce)', () => {
    const e = new GestureEngine()
    const p = { x: 300, y: 300 }
    const { last } = run(e, [item('a', 300, 300)], [
      ...open(p),
      ...repeat(5, () => [hand(p, PINCH)]),
      [hand(p, OPEN)],
      ...repeat(3, () => [hand(p, PINCH)]),
    ])
    expect(last.hands[0].phase).toBe('dragging')
  })

  it('pinching away from images grabs nothing, even when moved over one', () => {
    const e = new GestureEngine()
    const { items, last } = run(e, [item('a', 300, 300)], [
      ...open({ x: 800, y: 800 }),
      ...repeat(5, () => [hand({ x: 800, y: 800 }, PINCH)]),
      ...glide({ x: 800, y: 800 }, { x: 300, y: 300 }, 20).map((p) => [hand(p, PINCH)]),
      ...repeat(10, () => [hand({ x: 300, y: 300 }, PINCH)]),
    ])
    expect(last.hands[0].phase).toBe('pinching-empty')
    expect(items[0].x).toBe(300)
  })

  it('grabs near (not only exactly on) an image', () => {
    const e = new GestureEngine()
    // Image spans x 200..400; pinch 25px outside the right edge.
    const { last } = run(e, [item('a', 300, 300)], [...open({ x: 425, y: 300 }), ...repeat(5, () => [hand({ x: 425, y: 300 }, PINCH)])])
    expect(last.hands[0].phase).toBe('dragging')
  })

  it('brings the grabbed image to the front', () => {
    const e = new GestureEngine()
    const { items } = run(e, [item('a', 300, 300, 1), item('b', 900, 300, 5)], [...open({ x: 300, y: 300 }), ...repeat(5, () => [hand({ x: 300, y: 300 }, PINCH)])])
    const a = items.find((i) => i.id === 'a')!
    expect(a.z).toBeGreaterThan(5)
  })

  it('picks the topmost of overlapping images', () => {
    const e = new GestureEngine()
    const { last } = run(e, [item('low', 300, 300, 1), item('high', 320, 300, 2)], [...open({ x: 310, y: 300 }), ...repeat(5, () => [hand({ x: 310, y: 300 }, PINCH)])])
    expect(last.hands[0].itemId).toBe('high')
  })

  it('two-hand pinch scales uniformly and rotates', () => {
    const e = new GestureEngine()
    const L0 = { x: 250, y: 300 }
    const R0 = { x: 350, y: 300 }
    let { items, last } = run(e, [item('a', 300, 300)], [
      ...repeat(4, () => [hand(L0, OPEN, 'Left'), hand(R0, OPEN, 'Right')]),
      ...repeat(5, () => [hand(L0, PINCH, 'Left'), hand(R0, OPEN, 'Right')]),
      ...repeat(5, () => [hand(L0, PINCH, 'Left'), hand(R0, PINCH, 'Right')]),
    ])
    expect(last.hands.every((h) => h.phase === 'resizing')).toBe(true)
    // Spread to twice the distance and rotate the pair 90°: R ends up below L.
    const L1 = { x: 300, y: 200 }
    const R1 = { x: 300, y: 400 }
    // Move both hands along a quarter-circle arc while spreading them apart.
    const arc = repeat(40, (i) => {
      const k = (i + 1) / 40
      const r = 50 + 50 * k
      const th = (Math.PI / 2) * k
      return [
        hand({ x: 300 - r * Math.cos(th), y: 300 - r * Math.sin(th) }, PINCH, 'Left'),
        hand({ x: 300 + r * Math.cos(th), y: 300 + r * Math.sin(th) }, PINCH, 'Right'),
      ]
    })
    ;({ items, last } = run(e, items, [...arc, ...repeat(60, () => [hand(L1, PINCH, 'Left'), hand(R1, PINCH, 'Right')])], 1000))
    const a = items[0]
    expect(a.scale).toBeCloseTo(2, 1)
    expect(a.rotation).toBeCloseTo(Math.PI / 2, 1)
    expect(a.aspect).toBe(0.5) // proportions preserved: only `scale` changes size
    expect(a.x).toBeCloseTo(300, 0)
    expect(a.y).toBeCloseTo(300, 0)
  })

  it('releasing one hand of a two-hand grip continues dragging without a jump', () => {
    const e = new GestureEngine()
    const L = { x: 250, y: 300 }
    const R = { x: 350, y: 300 }
    let { items, last } = run(e, [item('a', 300, 300)], [
      ...repeat(4, () => [hand(L, OPEN, 'Left'), hand(R, OPEN, 'Right')]),
      ...repeat(5, () => [hand(L, PINCH, 'Left'), hand(R, OPEN, 'Right')]),
      ...repeat(5, () => [hand(L, PINCH, 'Left'), hand(R, PINCH, 'Right')]),
      ...repeat(5, () => [hand(L, PINCH, 'Left'), hand(R, OPEN, 'Right')]),
    ])
    const before = { x: items[0].x, y: items[0].y }
    expect(last.hands.find((h) => h.pinched)?.phase).toBe('dragging')
    ;({ items } = run(e, items, [[hand(L, PINCH, 'Left'), hand(R, OPEN, 'Right')]], 500))
    expect(items[0].x).toBeCloseTo(before.x, 3)
    expect(items[0].y).toBeCloseTo(before.y, 3)
  })

  it('holds still briefly when tracking drops, then releases and keeps the position', () => {
    const e = new GestureEngine()
    const p = { x: 300, y: 300 }
    let { items, last, t } = run(e, [item('a', 300, 300)], [
      ...open(p),
      ...repeat(5, () => [hand(p, PINCH)]),
      ...repeat(40, () => [hand({ x: 360, y: 300 }, PINCH)]),
    ])
    const pos = items[0].x
    // 100ms gap: still held, flagged as lost
    last = e.step([], t + 100, items)
    expect(last.hands[0]).toMatchObject({ phase: 'dragging', lost: true })
    // 400ms gap: released, image stays where it was
    last = e.step([], t + 400, items)
    expect(last.hands).toHaveLength(0)
    expect(last.items[0].x).toBe(pos)
    // A new hand appearing elsewhere doesn't pick it up without a fresh pinch on it
    ;({ items } = run(e, last.items, repeat(10, () => [hand({ x: 900, y: 300 }, OPEN)]), t + 500))
    expect(items[0].x).toBe(pos)
  })

  it('a hand that appears already pinched cannot grab until it opens first', () => {
    const e = new GestureEngine()
    const p = { x: 300, y: 300 }
    let { last } = run(e, [item('a', 300, 300)], repeat(10, () => [hand(p, PINCH)]))
    expect(last.hands[0].phase).toBe('open')
    ;({ last } = run(e, last.items, [...open(p), ...repeat(5, () => [hand(p, PINCH)])], 1000))
    expect(last.hands[0].phase).toBe('dragging')
  })

  it('keeps hand identity when the model flips the handedness label', () => {
    const e = new GestureEngine()
    const p = { x: 300, y: 300 }
    const { last } = run(e, [item('a', 300, 300)], [
      ...open(p),
      ...repeat(5, () => [hand(p, PINCH, 'Right')]),
      ...repeat(5, () => [hand(p, PINCH, 'Left')]),
    ])
    expect(last.hands).toHaveLength(1)
    expect(last.hands[0].phase).toBe('dragging')
  })
})

describe('mapToStage (mirroring + object-fit: cover)', () => {
  it('mirrors x so moving your hand right moves the cursor right on screen', () => {
    const video = { w: 1280, h: 720 }
    const stage = { w: 1280, h: 720 }
    // In the raw camera frame, your right-hand side appears at small x.
    expect(mapToStage(0.1, 0.5, video, stage).x).toBeCloseTo(1152)
    expect(mapToStage(0.9, 0.5, video, stage).x).toBeCloseTo(128)
  })

  it('accounts for the cover crop when aspect ratios differ', () => {
    // 16:9 video in a square stage: scaled to 1000 tall → 1777.8 wide, cropped 388.9 each side.
    const p = mapToStage(0.5, 0.5, { w: 1280, h: 720 }, { w: 1000, h: 1000 })
    expect(p.x).toBeCloseTo(500)
    expect(p.y).toBeCloseTo(500)
    const edge = mapToStage(1, 0, { w: 1280, h: 720 }, { w: 1000, h: 1000 })
    expect(edge.x).toBeCloseTo(-388.9, 0)
    expect(edge.y).toBeCloseTo(0)
  })
})

describe('GestureEngine: tap to preview', () => {
  /** Like `run`, but collects every tap emitted along the way. */
  function runTaps(engine: GestureEngine, items: Item[], frames: HandFrame[][], opts = {}) {
    let cur = items
    let t = 0
    const taps: ReturnType<GestureEngine['step']>['taps'] = []
    let last!: ReturnType<GestureEngine['step']>
    for (const f of frames) {
      t += 16
      last = engine.step(f, t, cur, opts)
      cur = last.items
      taps.push(...last.taps)
    }
    return { items: cur, taps, last }
  }
  const pinchAt = (p: Vec2, n: number, key?: string) => repeat(n, () => [hand(p, PINCH, key)])
  const quickTap = (p: Vec2) => [...open(p, 4), ...pinchAt(p, 6), ...open(p, 5)]
  /** Taps with the point rounded away from One Euro float noise. */
  const tidy = (taps: { point: Vec2; itemId: string | null }[]) =>
    taps.map((t) => ({ ...t, point: { x: Math.round(t.point.x), y: Math.round(t.point.y) } }))

  it('a short, still pinch-and-release taps the image once and leaves it in place', () => {
    const p = { x: 300, y: 300 }
    const { items, taps } = runTaps(new GestureEngine(), [item('a', 300, 300)], quickTap(p))
    expect(tidy(taps)).toEqual([{ point: p, itemId: 'a' }])
    expect(items[0]).toMatchObject({ x: 300, y: 300 })
  })

  it('tiny hand jitter during the tap is undone', () => {
    const p = { x: 300, y: 300 }
    const q = { x: 312, y: 306 }
    const { items, taps } = runTaps(new GestureEngine(), [item('a', 300, 300)], [...open(p, 4), ...pinchAt(p, 3), ...pinchAt(q, 3), ...open(q, 5)])
    expect(taps).toHaveLength(1)
    expect(items[0]).toMatchObject({ x: 300, y: 300 })
  })

  it('dragging never taps', () => {
    const a = { x: 300, y: 300 }
    const b = { x: 420, y: 330 }
    const { items, taps } = runTaps(new GestureEngine(), [item('a', 300, 300)], [
      ...open(a, 4),
      ...pinchAt(a, 3),
      ...glide(a, b, 8).map((p) => [hand(p, PINCH)]),
      ...open(b, 5),
    ])
    expect(taps).toEqual([])
    expect(items[0].x).toBeGreaterThan(380)
  })

  it('holding a pinch too long is not a tap', () => {
    const p = { x: 300, y: 300 }
    const { taps } = runTaps(new GestureEngine(), [item('a', 300, 300)], [...open(p, 4), ...pinchAt(p, 40), ...open(p, 5)])
    expect(taps).toEqual([])
  })

  it('fires once per tap, with a cooldown between taps', () => {
    const p = { x: 300, y: 300 }
    const fast = runTaps(new GestureEngine(), [item('a', 300, 300)], [...quickTap(p), ...quickTap(p)])
    expect(fast.taps).toHaveLength(1)
    const slow = runTaps(new GestureEngine(), [item('a', 300, 300)], [...quickTap(p), ...open(p, 30), ...quickTap(p)])
    expect(slow.taps).toHaveLength(2)
  })

  it('a tap on empty space reports no image', () => {
    const p = { x: 700, y: 600 }
    const { taps } = runTaps(new GestureEngine(), [item('a', 300, 300)], quickTap(p))
    expect(tidy(taps)).toEqual([{ point: p, itemId: null }])
  })

  it('blocked areas (an open preview) neither grab nor hover the image underneath', () => {
    const p = { x: 300, y: 300 }
    const blockers = [{ x: 250, y: 250, w: 100, h: 100 }]
    const { items, taps, last } = runTaps(new GestureEngine(), [item('a', 300, 300)], [...quickTap(p), ...open(p, 2)], { blockers })
    expect(tidy(taps)).toEqual([{ point: p, itemId: null }])
    expect(items[0].z).toBe(1)
    expect(last.hands[0].hoverId).toBeNull()
  })

  it('hovers with the index fingertip, not the pinch midpoint', () => {
    const tip = { x: 300, y: 300 }
    const points = repeat(21, () => ({ x: 700, y: 600 }))
    points[8] = tip
    const frame = (): HandFrame[] => [{ key: 'Right', pinch: { x: 700, y: 600 }, pinchRatio: OPEN, points }]
    const { last } = runTaps(new GestureEngine(), [item('a', 300, 300)], repeat(4, frame))
    expect(last.hands[0].hoverId).toBe('a')
    expect(last.hands[0].tip.x).toBeCloseTo(tip.x)
    expect(last.hands[0].tip.y).toBeCloseTo(tip.y)
  })

  it('two-hand resizing never taps, even when released quickly', () => {
    const l = { x: 240, y: 300 }
    const r = { x: 360, y: 300 }
    const both = (ratio: number) => [hand(l, ratio, 'Left'), hand(r, ratio, 'Right')]
    const { taps } = runTaps(new GestureEngine(), [item('a', 300, 300)], [...repeat(4, () => both(OPEN)), ...repeat(5, () => both(PINCH)), ...repeat(5, () => both(OPEN))])
    expect(taps).toEqual([])
  })

  it('losing the hand mid-pinch is not a tap', () => {
    const p = { x: 300, y: 300 }
    const { taps } = runTaps(new GestureEngine(), [item('a', 300, 300)], [...open(p, 4), ...pinchAt(p, 4), ...repeat(30, () => [])])
    expect(taps).toEqual([])
  })
})
