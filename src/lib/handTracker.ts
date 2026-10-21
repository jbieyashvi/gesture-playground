import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { mapToStage } from './geometry'
import type { HandFrame } from './types'

// Both are served from /public, so nothing leaves the machine and it works offline.
const WASM_ROOT = `${import.meta.env.BASE_URL}mediapipe/wasm`
const MODEL_PATH = `${import.meta.env.BASE_URL}models/hand_landmarker.task`

export type TrackerErrorKind = 'unsupported' | 'insecure' | 'denied' | 'no-camera' | 'camera-busy' | 'model' | 'unknown'

export class TrackerError extends Error {
  kind: TrackerErrorKind
  constructor(kind: TrackerErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

/** Returns a user-facing reason the browser can't do hand tracking, or null if it can. */
export function unsupportedReason(): TrackerError | null {
  if (!window.isSecureContext) {
    return new TrackerError('insecure', 'Camera access needs a secure page. Open the app on http://localhost or over HTTPS.')
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return new TrackerError('unsupported', 'This browser can’t access a camera. Try a recent Chrome, Edge, Firefox or Safari.')
  }
  if (typeof WebAssembly !== 'object') {
    return new TrackerError('unsupported', 'This browser doesn’t support WebAssembly, which hand tracking needs.')
  }
  return null
}

let visionPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null

/** The WASM fileset, shared by the hand and face models. */
export function loadVision() {
  if (!visionPromise) {
    visionPromise = FilesetResolver.forVisionTasks(WASM_ROOT).catch((err) => {
      visionPromise = null
      throw err
    })
  }
  return visionPromise
}

let landmarkerPromise: Promise<HandLandmarker> | null = null

export function loadHandLandmarker(): Promise<HandLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await loadVision()
      const options = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: 'VIDEO' as const,
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.5,
      })
      try {
        return await HandLandmarker.createFromOptions(vision, options('GPU'))
      } catch (gpuErr) {
        console.warn('[hand-tracker] GPU delegate unavailable, falling back to CPU', gpuErr)
        return await HandLandmarker.createFromOptions(vision, options('CPU'))
      }
    })().catch((err) => {
      landmarkerPromise = null // allow retry
      throw new TrackerError('model', `Couldn’t load the hand-tracking model. ${err instanceof Error ? err.message : ''}`.trim())
    })
  }
  return landmarkerPromise
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const unsupported = unsupportedReason()
  if (unsupported) throw unsupported
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: false,
    })
  } catch (err) {
    throw cameraError(err)
  }
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  await video.play()
  if (!video.videoWidth) {
    await new Promise<void>((resolve) => video.addEventListener('loadedmetadata', () => resolve(), { once: true }))
  }
  return stream
}

export function stopCamera(video: HTMLVideoElement | null, stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
  if (video) video.srcObject = null
}

function cameraError(err: unknown): TrackerError {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new TrackerError(
        'denied',
        'Camera permission was denied. Allow camera access for this site in your browser’s address bar, then press Start camera again.',
      )
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new TrackerError('no-camera', 'No camera was found. Connect a webcam and try again — mouse controls still work.')
    case 'NotReadableError':
    case 'AbortError':
      return new TrackerError('camera-busy', 'The camera is in use by another app or couldn’t be started. Close other apps using it and retry.')
    default:
      return new TrackerError('unknown', `Couldn’t start the camera${err instanceof Error ? `: ${err.message}` : '.'}`)
  }
}

const THUMB_TIP = 4
const INDEX_TIP = 8
const WRIST = 0
const MIDDLE_MCP = 9

/** Converts a MediaPipe result into stage-space hand frames (mirrored to match the preview). */
export function toHandFrames(
  result: HandLandmarkerResult,
  video: { w: number; h: number },
  stage: { w: number; h: number },
): HandFrame[] {
  return result.landmarks.map((lms, i) => {
    // Distances are measured in camera pixels (incl. depth) so the ratio is scale-invariant.
    const px = (a: number, b: number) =>
      Math.hypot((lms[a].x - lms[b].x) * video.w, (lms[a].y - lms[b].y) * video.h, (lms[a].z - lms[b].z) * video.w)
    const palm = Math.max(px(WRIST, MIDDLE_MCP), 1)
    const points = lms.map((l) => mapToStage(l.x, l.y, video, stage))
    const t = points[THUMB_TIP]
    const f = points[INDEX_TIP]
    return {
      key: result.handedness[i]?.[0]?.categoryName ?? `hand${i}`,
      pinch: { x: (t.x + f.x) / 2, y: (t.y + f.y) / 2 },
      pinchRatio: px(THUMB_TIP, INDEX_TIP) / palm,
      points,
    }
  })
}

export const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS
