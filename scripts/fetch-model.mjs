// Downloads the Hand and Face Landmarker models into public/models if they're missing.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODELS = {
  'hand_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  'face_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

for (const [file, url] of Object.entries(MODELS)) {
  const dest = resolve(root, 'public/models', file)
  if (existsSync(dest)) {
    console.log('Model already present:', dest)
    continue
  }
  mkdirSync(dirname(dest), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Model download failed (${file}): ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  console.log('Downloaded model →', dest)
}
