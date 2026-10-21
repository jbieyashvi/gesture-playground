import { FaceLandmarker } from '@mediapipe/tasks-vision'
import { loadVision, TrackerError } from './handTracker'
import { anchorsFromLandmarks, type Anchors } from './reveal'

// Served from /public like the hand model — webcam frames never leave the device.
const MODEL_PATH = `${import.meta.env.BASE_URL}models/face_landmarker.task`

type Mode = 'VIDEO' | 'IMAGE'

async function create(runningMode: Mode) {
  const vision = await loadVision()
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode,
    // One face keeps MediaPipe's built-in temporal smoothing on.
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
  try {
    return await FaceLandmarker.createFromOptions(vision, options('GPU'))
  } catch (gpuErr) {
    console.warn('[face-tracker] GPU delegate unavailable, falling back to CPU', gpuErr)
    return await FaceLandmarker.createFromOptions(vision, options('CPU'))
  }
}

const cache: Partial<Record<Mode, Promise<FaceLandmarker>>> = {}

function load(mode: Mode): Promise<FaceLandmarker> {
  cache[mode] ??= create(mode).catch((err) => {
    delete cache[mode] // allow retry
    throw new TrackerError('model', `Couldn’t load the face-tracking model. ${err instanceof Error ? err.message : ''}`.trim())
  })
  return cache[mode]
}

/** VIDEO-mode landmarker for the webcam loop. */
export const loadFaceLandmarker = () => load('VIDEO')

/**
 * Tries to find eyes and mouth on an uploaded portrait. The face model is trained on photos,
 * so it often misses stylised anime faces — callers fall back to manual markers.
 */
export async function detectPortraitAnchors(img: HTMLImageElement): Promise<Anchors | null> {
  const landmarker = await load('IMAGE')
  return anchorsFromLandmarks(landmarker.detect(img).faceLandmarks[0])
}
