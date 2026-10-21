import { describe, expect, it } from 'vitest'
import {
  anchorsFromLandmarks,
  applyMat,
  DEFAULT_CALIBRATION,
  faceFrameFromLandmarks,
  faceMatrix,
  REVEAL_CONFIG,
  RevealTracker,
  type Anchors,
  type FaceFrame,
} from './reveal'
import type { HandFrame, Vec2 } from './types'

const hand = (key: string, pinch: Vec2): HandFrame => ({ key, pinch, pinchRatio: 1, points: [] })
const face: FaceFrame = { leftEye: { x: 400, y: 300 }, rightEye: { x: 500, y: 300 }, mouth: { x: 450, y: 410 } }
const img = { w: 480, h: 600 }
const anchors: Anchors = { leftEye: { x: 0.35, y: 0.5 }, rightEye: { x: 0.65, y: 0.5 }, mouth: { x: 0.5, y: 0.7 } }
const px = (p: Vec2) => ({ x: p.x * img.w, y: p.y * img.h })
const near = (a: Vec2, b: Vec2, eps = 0.5) => {
  expect(a.x).toBeCloseTo(b.x, 0)
  expect(Math.abs(a.y - b.y)).toBeLessThan(eps)
}

describe('faceMatrix', () => {
  it('puts the portrait eyes exactly on the face eyes', () => {
    const m = faceMatrix(face, anchors, img, DEFAULT_CALIBRATION)
    near(applyMat(m, px(anchors.leftEye)), face.leftEye)
    near(applyMat(m, px(anchors.rightEye)), face.rightEye)
  })

  it('aligns the mouth too when proportions are within the clamp', () => {
    const m = faceMatrix(face, anchors, img, DEFAULT_CALIBRATION)
    near(applyMat(m, px(anchors.mouth)), face.mouth, 1)
  })

  it('follows head tilt', () => {
    const r = Math.PI / 6
    const rot = (p: Vec2) => ({ x: 450 + (p.x - 450) * Math.cos(r) - (p.y - 300) * Math.sin(r), y: 300 + (p.x - 450) * Math.sin(r) + (p.y - 300) * Math.cos(r) })
    const tilted = { leftEye: rot(face.leftEye), rightEye: rot(face.rightEye), mouth: rot(face.mouth) }
    const m = faceMatrix(tilted, anchors, img, DEFAULT_CALIBRATION)
    near(applyMat(m, px(anchors.leftEye)), tilted.leftEye)
    near(applyMat(m, px(anchors.rightEye)), tilted.rightEye)
    near(applyMat(m, px(anchors.mouth)), tilted.mouth, 1)
  })

  it('scales and offsets around the eye midpoint in face units', () => {
    const m = faceMatrix(face, anchors, img, { ...DEFAULT_CALIBRATION, scale: 2, dx: 0.5, dy: -0.25 })
    const l = applyMat(m, px(anchors.leftEye))
    const r = applyMat(m, px(anchors.rightEye))
    expect(r.x - l.x).toBeCloseTo(200, 3) // eye distance doubled
    near({ x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 }, { x: 450 + 50, y: 300 - 25 })
  })

  it('clamps extreme vertical stretch', () => {
    const m = faceMatrix({ ...face, mouth: { x: 450, y: 900 } }, anchors, img, DEFAULT_CALIBRATION)
    const sy = Math.hypot(m[2], m[3])
    const sx = Math.hypot(m[0], m[1])
    expect(sy / sx).toBeCloseTo(1.4, 5)
  })
})

describe('face landmark mapping', () => {
  const lms = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
  // Subject's right eye is on the image left in the raw frame.
  for (const i of [33, 133]) lms[i] = { x: 0.4, y: 0.4 }
  for (const i of [362, 263]) lms[i] = { x: 0.6, y: 0.4 }
  for (const i of [13, 14]) lms[i] = { x: 0.5, y: 0.6 }

  it('mirrors so the subject’s left eye lands on screen left', () => {
    const f = faceFrameFromLandmarks(lms, { w: 1000, h: 1000 }, { w: 1000, h: 1000 })!
    expect(f.leftEye.x).toBeCloseTo(400)
    expect(f.rightEye.x).toBeCloseTo(600)
    expect(f.mouth.y).toBeCloseTo(600)
  })

  it('reads portrait anchors un-mirrored (image-left eye first)', () => {
    const a = anchorsFromLandmarks(lms)!
    expect(a.leftEye.x).toBeCloseTo(0.4)
    expect(a.rightEye.x).toBeCloseTo(0.6)
  })

  it('returns null without a face', () => {
    expect(faceFrameFromLandmarks(undefined, { w: 1, h: 1 }, { w: 1, h: 1 })).toBeNull()
  })
})

describe('RevealTracker', () => {
  it('uses the two pinch points as opposite corners, whichever hand is which', () => {
    const t = new RevealTracker()
    const s1 = t.step([hand('Left', { x: 500, y: 100 }), hand('Right', { x: 200, y: 400 })], null, 0)
    expect(s1.window).toEqual({ x: 200, y: 100, w: 300, h: 300 })
    const s2 = t.step([hand('Right', { x: 200, y: 400 }), hand('Left', { x: 500, y: 100 })], null, 16)
    expect(s2.window).toEqual(s1.window)
  })

  it('smooths window jitter', () => {
    const t = new RevealTracker()
    let w = t.step([hand('a', { x: 100, y: 100 }), hand('b', { x: 400, y: 400 })], null, 0).window!
    for (let i = 1; i < 30; i++) {
      const j = i % 2 ? 6 : -6
      w = t.step([hand('a', { x: 100 + j, y: 100 }), hand('b', { x: 400, y: 400 })], null, i * 16).window!
    }
    expect(Math.abs(w.x - 100)).toBeLessThan(3)
  })

  it('keeps the window through a brief hand dropout, then closes it', () => {
    const t = new RevealTracker()
    const two = [hand('a', { x: 100, y: 100 }), hand('b', { x: 400, y: 300 })]
    for (let i = 0; i < 20; i++) t.step(two, null, i * 16)
    const held = t.step([two[0]], null, 20 * 16 + REVEAL_CONFIG.windowGraceMs - 40)
    expect(held.window).not.toBeNull()
    expect(held.windowAlpha).toBe(1)
    let s = held
    for (let now = 20 * 16 + REVEAL_CONFIG.windowGraceMs + 20; now < 2000; now += 16) s = t.step([two[0]], null, now)
    expect(s.window).toBeNull()
    expect(s.windowAlpha).toBe(0)
  })

  it('closes the window when the hands come together', () => {
    const t = new RevealTracker()
    let s = t.step([hand('a', { x: 300, y: 300 }), hand('b', { x: 310, y: 305 })], null, 0)
    for (let i = 1; i < 30; i++) s = t.step([hand('a', { x: 300, y: 300 }), hand('b', { x: 310, y: 305 })], null, i * 16)
    expect(s.windowAlpha).toBe(0)
  })

  it('tracks the face independently of the window and hides it when lost', () => {
    const t = new RevealTracker()
    for (let i = 0; i < 10; i++) t.step([], face, i * 16)
    const seen = t.step([], face, 160)
    expect(seen.face).not.toBeNull()
    expect(seen.window).toBeNull()
    const grace = t.step([], null, 160 + REVEAL_CONFIG.faceGraceMs - 20)
    expect(grace.face).not.toBeNull()
    const lost = t.step([], null, 160 + REVEAL_CONFIG.faceGraceMs + 20)
    expect(lost.face).toBeNull()
    expect(lost.faceAlpha).toBe(0)
  })

  it('re-acquires a face at its new position instead of gliding from the old one', () => {
    const t = new RevealTracker()
    for (let i = 0; i < 10; i++) t.step([], face, i * 16)
    t.step([], null, 1000)
    const moved = { leftEye: { x: 100, y: 300 }, rightEye: { x: 200, y: 300 }, mouth: { x: 150, y: 410 } }
    const s = t.step([], moved, 1016)
    expect(s.face!.leftEye.x).toBeCloseTo(100)
  })
})
