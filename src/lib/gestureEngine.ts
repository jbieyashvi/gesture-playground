import { angle, angleDelta, dist, mid, rotate, topItemAt } from './geometry'
import { OneEuro2D } from './oneEuro'
import type { HandFrame, HandPhase, HandStatus, Item, Vec2 } from './types'

export const GESTURE_CONFIG = {
  /** Pinch ratio below which a pinch starts (thumb–index distance / palm size). */
  grabRatio: 0.3,
  /** Pinch ratio above which a pinch ends. The gap between the two is the hysteresis band. */
  releaseRatio: 0.5,
  /** Consecutive frames needed to confirm a grab / release (debounce). */
  grabFrames: 2,
  releaseFrames: 3,
  /** How long a hand may vanish before whatever it holds is dropped in place. */
  lostGraceMs: 300,
  /** Pinches within this many px of an image edge still grab it. */
  nearMargin: 40,
  /** Max px a hand may jump between frames and still count as the same hand. */
  matchPx: 260,
  minScale: 0.12,
  maxScale: 8,
}

type Config = typeof GESTURE_CONFIG

interface Track {
  id: string
  filter: OneEuro2D
  raw: Vec2
  pinch: Vec2
  ratio: number
  pinched: boolean
  closeFrames: number
  openFrames: number
  lastSeen: number
  seenThisFrame: boolean
  itemId: string | null
  /** Pinch started away from any image — don't grab things it later passes over. */
  empty: boolean
  /** Seen with an open hand since appearing; a hand that (re)appears already pinched can't grab. */
  armed: boolean
  /** item centre − pinch point, captured when a one-hand drag starts. */
  offset: Vec2
}

interface TwoHandGrip {
  itemId: string
  a: string
  b: string
  d0: number
  a0: number
  s0: number
  r0: number
  /** item centre − hands midpoint at grip start. */
  rel0: Vec2
}

export interface StepResult {
  items: Item[]
  changed: boolean
  hands: HandStatus[]
  selectedId: string | null
}

export class GestureEngine {
  private tracks = new Map<string, Track>()
  private grips = new Map<string, TwoHandGrip>()
  private nextId = 1
  private cfg: Config
  selectedId: string | null = null

  constructor(cfg: Partial<Config> = {}) {
    this.cfg = { ...GESTURE_CONFIG, ...cfg }
  }

  /** Drop everything currently held (e.g. camera stopped). Items keep their positions. */
  reset() {
    this.tracks.clear()
    this.grips.clear()
  }

  step(frames: HandFrame[], now: number, items: Item[]): StepResult {
    const cfg = this.cfg
    const byId = new Map(items.map((it) => [it.id, it]))
    const touched = new Set<string>()
    const update = (id: string, patch: Partial<Item>) => {
      const cur = byId.get(id)
      if (!cur) return
      byId.set(id, { ...cur, ...patch })
      touched.add(id)
    }

    // 1. Match incoming hands to existing tracks by proximity (labels from the model can flicker).
    for (const t of this.tracks.values()) t.seenThisFrame = false
    const pairs: { f: number; t: Track; d: number }[] = []
    frames.forEach((f, i) => {
      for (const t of this.tracks.values()) pairs.push({ f: i, t, d: dist(f.pinch, t.raw) })
    })
    pairs.sort((p, q) => p.d - q.d)
    const assigned = new Map<number, Track>()
    for (const p of pairs) {
      if (p.d > cfg.matchPx || assigned.has(p.f) || p.t.seenThisFrame) continue
      assigned.set(p.f, p.t)
      p.t.seenThisFrame = true
    }

    const presses: Track[] = []
    const releases: Track[] = []

    frames.forEach((f, i) => {
      let t = assigned.get(i)
      if (!t) {
        t = {
          id: `h${this.nextId++}`,
          filter: new OneEuro2D(1.0, 0.015),
          raw: f.pinch,
          pinch: f.pinch,
          ratio: f.pinchRatio,
          pinched: false,
          closeFrames: 0,
          openFrames: 0,
          lastSeen: now,
          seenThisFrame: true,
          itemId: null,
          empty: false,
          armed: false,
          offset: { x: 0, y: 0 },
        }
        this.tracks.set(t.id, t)
      }
      t.raw = f.pinch
      t.pinch = t.filter.filter(f.pinch, now)
      t.ratio = t.ratio * 0.4 + f.pinchRatio * 0.6
      t.lastSeen = now

      // 2. Pinch state with hysteresis + debounce.
      if (t.ratio > cfg.releaseRatio) t.armed = true
      if (!t.pinched && t.armed) {
        t.closeFrames = t.ratio < cfg.grabRatio ? t.closeFrames + 1 : 0
        if (t.closeFrames >= cfg.grabFrames) {
          t.pinched = true
          t.openFrames = 0
          presses.push(t)
        }
      } else if (t.pinched) {
        t.openFrames = t.ratio > cfg.releaseRatio ? t.openFrames + 1 : 0
        if (t.openFrames >= cfg.releaseFrames) {
          t.pinched = false
          t.closeFrames = 0
          releases.push(t)
        }
      }
    })

    // 3. Hands that vanished: hold still during the grace period, then drop safely.
    for (const t of [...this.tracks.values()]) {
      if (t.seenThisFrame) continue
      if (now - t.lastSeen > cfg.lostGraceMs) {
        if (t.pinched) releases.push(t)
        this.tracks.delete(t.id)
      }
    }

    for (const t of releases) this.release(t, byId)

    for (const t of presses) {
      const current = items.map((it) => byId.get(it.id) ?? it)
      const hit = topItemAt(current, t.pinch, cfg.nearMargin)
      const holders = hit ? this.holdersOf(hit.id) : []
      if (!hit || holders.length >= 2) {
        t.empty = true
        continue
      }
      t.itemId = hit.id
      this.selectedId = hit.id
      const maxZ = Math.max(0, ...current.map((it) => it.z))
      if (hit.z < maxZ) update(hit.id, { z: maxZ + 1 })
      if (holders.length === 0) {
        t.offset = { x: hit.x - t.pinch.x, y: hit.y - t.pinch.y }
      } else {
        const other = holders[0]
        const m = mid(other.pinch, t.pinch)
        this.grips.set(hit.id, {
          itemId: hit.id,
          a: other.id,
          b: t.id,
          d0: Math.max(dist(other.pinch, t.pinch), 1),
          a0: angle(other.pinch, t.pinch),
          s0: hit.scale,
          r0: hit.rotation,
          rel0: { x: hit.x - m.x, y: hit.y - m.y },
        })
      }
    }

    // 4. Move held items.
    const done = new Set<string>()
    for (const t of this.tracks.values()) {
      if (!t.itemId || done.has(t.itemId)) continue
      const id = t.itemId
      done.add(id)
      const grip = this.grips.get(id)
      if (grip) {
        const a = this.tracks.get(grip.a)
        const b = this.tracks.get(grip.b)
        if (!a || !b || !a.seenThisFrame || !b.seenThisFrame) continue // freeze while a hand is lost
        const ratio = dist(a.pinch, b.pinch) / grip.d0
        const scale = clamp(grip.s0 * ratio, cfg.minScale, cfg.maxScale)
        const k = scale / grip.s0
        const dTheta = angleDelta(grip.a0, angle(a.pinch, b.pinch))
        const m = mid(a.pinch, b.pinch)
        const rel = rotate({ x: grip.rel0.x * k, y: grip.rel0.y * k }, dTheta)
        update(id, { scale, rotation: grip.r0 + dTheta, x: m.x + rel.x, y: m.y + rel.y })
      } else if (t.seenThisFrame) {
        update(id, { x: t.pinch.x + t.offset.x, y: t.pinch.y + t.offset.y })
      }
    }

    const hands: HandStatus[] = [...this.tracks.values()].map((t) => ({
      key: t.id,
      phase: this.phaseOf(t),
      pinch: t.pinch,
      pinched: t.pinched,
      itemId: t.itemId,
      lost: !t.seenThisFrame,
    }))

    return {
      items: touched.size ? items.map((it) => byId.get(it.id) ?? it) : items,
      changed: touched.size > 0,
      hands,
      selectedId: this.selectedId,
    }
  }

  private holdersOf(itemId: string) {
    return [...this.tracks.values()].filter((t) => t.itemId === itemId)
  }

  private phaseOf(t: Track): HandPhase {
    if (t.itemId) return this.grips.has(t.itemId) ? 'resizing' : 'dragging'
    return t.pinched ? 'pinching-empty' : 'open'
  }

  private release(t: Track, items: Map<string, Item>) {
    t.empty = false
    const id = t.itemId
    t.itemId = null
    if (!id) return
    const grip = this.grips.get(id)
    if (!grip) return
    this.grips.delete(id)
    // The remaining hand carries on dragging from where the image is now — no jump.
    const other = this.tracks.get(grip.a === t.id ? grip.b : grip.a)
    const item = items.get(id)
    if (other && other.itemId === id && item) other.offset = { x: item.x - other.pinch.x, y: item.y - other.pinch.y }
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
