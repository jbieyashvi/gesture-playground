export interface Vec2 {
  x: number
  y: number
}

/** An image placed on the stage. Position is the centre, in stage pixels. */
export interface Item {
  id: string
  src: string
  name: string
  /** Width at scale 1, in stage pixels. Height is derived from `aspect`. */
  baseWidth: number
  /** height / width — fixed, so proportions never change. */
  aspect: number
  x: number
  y: number
  scale: number
  /** Radians, clockwise on screen. */
  rotation: number
  z: number
  /** True for object URLs we created and must revoke. */
  isObjectUrl?: boolean
}

/** One tracked hand for a single frame, already mapped to stage pixels (mirrored). */
export interface HandFrame {
  key: string
  /** Midpoint between thumb tip and index tip. */
  pinch: Vec2
  /** Thumb–index tip distance divided by palm size. Smaller = tighter pinch. */
  pinchRatio: number
  /** All 21 landmarks in stage pixels, for drawing. */
  points: Vec2[]
}

export type HandPhase = 'open' | 'pinching-empty' | 'dragging' | 'resizing'

export interface HandStatus {
  key: string
  phase: HandPhase
  pinch: Vec2
  pinched: boolean
  itemId: string | null
  /** True while the hand is missing but still inside the grace period. */
  lost: boolean
  /** Smoothed index fingertip — what the hand is pointing at. */
  tip: Vec2
  /** Item under the fingertip while the hand is open. */
  hoverId: string | null
}

/** A short pinch-and-release with little movement — the gesture equivalent of a click. */
export interface Tap {
  /** Where the fingertip was aiming just before the pinch. */
  point: Vec2
  itemId: string | null
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
