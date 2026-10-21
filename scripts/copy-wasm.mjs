// Copies MediaPipe's WASM runtime into public/ so the app runs fully locally (no CDN).
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const dest = resolve(root, 'public/mediapipe/wasm')
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log('Copied MediaPipe wasm →', dest)
