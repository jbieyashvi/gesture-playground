import { mapToStage } from './geometry'
import { OneEuro, OneEuro2D } from './oneEuro'
import type { HandFrame, Vec2 } from './types'

/** Stage-space face points used for alignment. "left"/"right" mean screen left/right in the mirrored preview. */
export interface FaceFrame {
  leftEye: Vec2
  rightEye: Vec2
  mouth: Vec2
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Portrait feature positions, normalised 0–1 in the (un-mirrored) portrait image. */
export interface Anchors {
  leftEye: Vec2
  rightEye: Vec2
  mouth: Vec2
}

export interface Calibration {
  /** Offsets in units of the eye distance, along / across the eye line. */
  dx: number
  dy: number
  scale: number
  opacity: number
}

export const DEFAULT_CALIBRATION: Calibration = { dx: 0, dy: 0, scale: 1, opacity: 1 }

/** Canvas `setTransform` order: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Mat = [number, number, number, number, number, number]

export const REVEAL_CONFIG = {
  /** A hand that drops out briefly keeps the window where it was. */
  windowGraceMs: 220,
  /** Short enough that a lost face never floats around. */
  faceGraceMs: 120,
  /** Hands closer than this (either axis) close the window. */
  minWindow: 28,
  fadeMs: 140,
}

// MediaPipe Face Mesh indices (subject's own left/right).
const SUBJECT_RIGHT_EYE = [33, 133]
const SUBJECT_LEFT_EYE = [362, 263]
const MOUTH = [13, 14]

type Landmark = { x: number; y: number }

const avg = (pts: Vec2[]): Vec2 => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
})

/**
 * Face landmarks (raw camera frame) → stage points in the mirrored preview.
 * Mirroring puts the subject's left eye on the screen's left.
 */
export function faceFrameFromLandmarks(
  lms: Landmark[] | undefined,
  video: { w: number; h: number },
  stage: { w: number; h: number },
): FaceFrame | null {
  if (!lms || lms.length < 300) return null
  const at = (ids: number[]) => avg(ids.map((i) => mapToStage(lms[i].x, lms[i].y, video, stage)))
  return { leftEye: at(SUBJECT_LEFT_EYE), rightEye: at(SUBJECT_RIGHT_EYE), mouth: at(MOUTH) }
}

/** Face landmarks on an (un-mirrored) portrait image → normalised anchors. The image-left eye is the subject's right. */
export function anchorsFromLandmarks(lms: Landmark[] | undefined): Anchors | null {
  if (!lms || lms.length < 300) return null
  const at = (ids: number[]) => avg(ids.map((i) => ({ x: lms[i].x, y: lms[i].y })))
  const a = { leftEye: at(SUBJECT_RIGHT_EYE), rightEye: at(SUBJECT_LEFT_EYE), mouth: at(MOUTH) }
  return a.leftEye.x < a.rightEye.x ? a : null
}

const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]
const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y]
const rotation = (r: number): Mat => [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]
const scaling = (sx: number, sy: number): Mat => [sx, 0, 0, sy, 0, 0]

export const applyMat = (m: Mat, p: Vec2): Vec2 => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Maps portrait pixels onto the face: the eyes line up exactly (position, size, tilt) and the mouth
 * sets the vertical stretch, clamped so the portrait keeps its character.
 */
export function faceMatrix(face: FaceFrame, anchors: Anchors, img: { w: number; h: number }, calib: Calibration): Mat {
  const px = (p: Vec2) => ({ x: p.x * img.w, y: p.y * img.h })
  const pl = px(anchors.leftEye)
  const pr = px(anchors.rightEye)
  const pm = px(anchors.mouth)

  const frame = (l: Vec2, r: Vec2, mouth: Vec2) => {
    const u = { x: r.x - l.x, y: r.y - l.y }
    const len = Math.max(Math.hypot(u.x, u.y), 1e-6)
    const ux = { x: u.x / len, y: u.y / len }
    const n = { x: -ux.y, y: ux.x } // perpendicular, pointing down the face
    const m = { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 }
    const drop = (mouth.x - m.x) * n.x + (mouth.y - m.y) * n.y
    return { len, ux, n, m, drop, angle: Math.atan2(u.y, u.x) }
  }
  const f = frame(face.leftEye, face.rightEye, face.mouth)
  const p = frame(pl, pr, pm)

  const sx = (f.len / p.len) * calib.scale
  const ratio = f.drop > 1 && p.drop > 1 ? clamp(f.drop / p.drop / (f.len / p.len), 0.75, 1.4) : 1
  const origin = {
    x: f.m.x + f.ux.x * calib.dx * f.len + f.n.x * calib.dy * f.len,
    y: f.m.y + f.ux.y * calib.dx * f.len + f.n.y * calib.dy * f.len,
  }
  return [translate(origin.x, origin.y), rotation(f.angle), scaling(sx, sx * ratio), rotation(-p.angle), translate(-p.m.x, -p.m.y)].reduce(mul)
}

export interface RevealState {
  /** Hand-controlled window, smoothed; null when hidden. */
  window: Rect | null
  windowAlpha: number
  /** Smoothed face; null as soon as tracking is lost (after a short grace). */
  face: FaceFrame | null
  faceAlpha: number
  hands: number
}

const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step))

/** Smooths the two-hand window and the face independently. Pure logic, no DOM. */
export class RevealTracker {
  private edges: OneEuro[] = []
  private eyes: OneEuro2D[] = []
  private rect: Rect | null = null
  private windowSeenAt = -Infinity
  private windowOpen = false
  private face: FaceFrame | null = null
  private faceSeenAt = -Infinity
  private windowAlpha = 0
  private faceAlpha = 0
  private lastT: number | null = null

  constructor() {
    this.reset()
  }

  reset() {
    this.edges = [0, 1, 2, 3].map(() => new OneEuro(1.0, 0.015))
    this.eyes = [0, 1, 2].map(() => new OneEuro2D(1.5, 0.01))
    this.rect = null
    this.windowSeenAt = this.faceSeenAt = -Infinity
    this.windowOpen = false
    this.face = null
    this.windowAlpha = this.faceAlpha = 0
    this.lastT = null
  }

  step(hands: HandFrame[], face: FaceFrame | null, now: number): RevealState {
    const dt = this.lastT === null ? 16 : Math.max(0, now - this.lastT)
    this.lastT = now
    const fade = dt / REVEAL_CONFIG.fadeMs

    // Window: the two pinch points are opposite corners. min/max makes it independent of which hand is which.
    if (hands.length >= 2) {
      const [a, b] = [hands[0].pinch, hands[1].pinch]
      if (now - this.windowSeenAt > REVEAL_CONFIG.windowGraceMs) this.edges = [0, 1, 2, 3].map(() => new OneEuro(1.0, 0.015))
      const [l, t, r, btm] = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)].map((v, i) =>
        this.edges[i].filter(v, now),
      )
      this.rect = { x: l, y: t, w: Math.max(0, r - l), h: Math.max(0, btm - t) }
      this.windowSeenAt = now
      this.windowOpen = this.rect.w >= REVEAL_CONFIG.minWindow && this.rect.h >= REVEAL_CONFIG.minWindow
    } else if (now - this.windowSeenAt > REVEAL_CONFIG.windowGraceMs) {
      this.windowOpen = false
    }
    this.windowAlpha = approach(this.windowAlpha, this.windowOpen ? 1 : 0, fade)
    if (this.windowAlpha === 0 && !this.windowOpen) this.rect = null

    // Face: hide quickly when lost; re-seed filters on reacquire so it doesn't glide in from the old spot.
    if (face) {
      if (now - this.faceSeenAt > REVEAL_CONFIG.faceGraceMs) this.eyes = [0, 1, 2].map(() => new OneEuro2D(1.5, 0.01))
      this.face = {
        leftEye: this.eyes[0].filter(face.leftEye, now),
        rightEye: this.eyes[1].filter(face.rightEye, now),
        mouth: this.eyes[2].filter(face.mouth, now),
      }
      this.faceSeenAt = now
    } else if (now - this.faceSeenAt > REVEAL_CONFIG.faceGraceMs) {
      this.face = null
    }
    this.faceAlpha = this.face ? approach(this.faceAlpha, 1, fade) : 0

    return {
      window: this.rect,
      windowAlpha: this.windowAlpha,
      face: this.face,
      faceAlpha: this.faceAlpha,
      hands: hands.length,
    }
  }
}
