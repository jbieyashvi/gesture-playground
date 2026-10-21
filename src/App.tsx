import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimePanel, type DetectState } from './components/AnimePanel'
import { GestureGuide } from './components/GestureGuide'
import { ImagePreview } from './components/ImagePreview'
import { CameraIcon, CloseIcon, GridIcon, HandIcon, HelpIcon, HideIcon, PresentIcon, ShowIcon, StopIcon, UploadIcon } from './components/Icons'
import { beginFrame, drawOverlay } from './lib/draw'
import { drawReveal, featherPortrait } from './lib/drawReveal'
import { detectPortraitAnchors, loadFaceLandmarker } from './lib/faceTracker'
import { angle, dist, itemSize, topItemAt } from './lib/geometry'
import { GestureEngine } from './lib/gestureEngine'
import { HAND_CONNECTIONS, loadHandLandmarker, startCamera, stopCamera, toHandFrames, TrackerError, unsupportedReason } from './lib/handTracker'
import { baseWidthFor, galleryRegion, gridLayout, newId } from './lib/layout'
import { previewLayout, previewTitle } from './lib/preview'
import { DEFAULT_CALIBRATION, faceFrameFromLandmarks, faceMatrix, RevealTracker, type Anchors, type Calibration, type FaceFrame } from './lib/reveal'
import { DEFAULT_ANCHORS, SAMPLE_PORTRAIT } from './lib/samplePortrait'
import { SAMPLES } from './lib/samples'
import type { HandFrame, HandStatus, Item, Rect, Tap, Vec2 } from './lib/types'

type CameraState = 'idle' | 'starting' | 'running'
type Mode = 'playground' | 'anime'
interface Portrait {
  src: string
  name: string
  anchors: Anchors
  isObjectUrl?: boolean
}
type ModelState = 'idle' | 'loading' | 'ready' | 'error'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const GUIDE_KEY = 'gesture-playground:guide-dismissed'

const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
const writeFlag = (key: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    /* storage unavailable — fine */
  }
}

const loadImageSize = (src: string) =>
  new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('decode failed'))
    img.src = src
  })

function createSamples(): Item[] {
  const stage = { w: window.innerWidth, h: window.innerHeight }
  const samples: Item[] = SAMPLES.map((s, i) => ({
    id: `sample-${i}`,
    src: s.src,
    name: s.name,
    aspect: s.h / s.w,
    baseWidth: baseWidthFor(s.h / s.w, stage.w),
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    z: i + 1,
  }))
  return gridLayout(samples, stage, galleryRegion(stage))
}

/** Element's box in stage coordinates (the stage fills the window). */
const stageRect = (el: Element | null, grow = 0): Rect | null => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left - grow, y: r.top - grow, w: r.width + 2 * grow, h: r.height + 2 * grow }
}
const inRect = (r: Rect | null, p: Vec2) => !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

interface PreviewState {
  id: string
  closing: boolean
  /** Opened from the keyboard — move focus into the card and back to the image on close. */
  viaKeyboard: boolean
}
/** Matches the fade-out in `.preview.closing`. */
const PREVIEW_EXIT_MS = 120

interface Summary {
  hands: number
  action: 'dragging' | 'resizing' | 'pinching' | null
  lost: boolean
  hoverIds: string[]
  heldIds: string[]
}
const EMPTY_SUMMARY: Summary = { hands: 0, action: null, lost: false, hoverIds: [], heldIds: [] }

interface RevealSummary {
  face: boolean
  window: boolean
}
const EMPTY_REVEAL: RevealSummary = { face: false, window: false }

const toStatuses = (frames: HandFrame[]): HandStatus[] =>
  frames.map((f) => ({ key: f.key, phase: 'open', pinch: f.pinch, pinched: false, itemId: null, lost: false, tip: f.pinch, hoverId: null }))

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const engineRef = useRef(new GestureEngine())
  const stageSize = useRef({ w: window.innerWidth, h: window.innerHeight })

  const [items, setItems] = useState<Item[]>(createSamples)
  const itemsRef = useRef<Item[]>(items)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [camera, setCamera] = useState<CameraState>('idle')
  const [model, setModel] = useState<ModelState>(() => (unsupportedReason() ? 'idle' : 'loading'))
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY)
  const [showLandmarks, setShowLandmarks] = useState(true)
  const showLandmarksRef = useRef(true)
  const [controlsHidden, setControlsHidden] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [guideOpen, setGuideOpen] = useState(() => !readFlag(GUIDE_KEY))
  const [dragOver, setDragOver] = useState(false)
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const previewIdRef = useRef<string | null>(null)
  const previewCardRef = useRef<HTMLDivElement>(null)
  const previewCloseRef = useRef<HTMLButtonElement>(null)

  // Anime Reveal
  const [mode, setMode] = useState<Mode>('playground')
  const modeRef = useRef<Mode>('playground')
  const revealRef = useRef(new RevealTracker())
  const faceLandmarkerRef = useRef<Awaited<ReturnType<typeof loadFaceLandmarker>> | null>(null)
  const [faceModel, setFaceModel] = useState<ModelState>('idle')
  const [portrait, setPortrait] = useState<Portrait>({ ...SAMPLE_PORTRAIT })
  const [calib, setCalib] = useState<Calibration>(DEFAULT_CALIBRATION)
  const [fullPreview, setFullPreview] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [softEdges, setSoftEdges] = useState(true)
  const [detect, setDetect] = useState<DetectState>('idle')
  const [revealSummary, setRevealSummary] = useState<RevealSummary>(EMPTY_REVEAL)
  const lastRevealKey = useRef('')
  /** What the render loop needs each frame, mirrored from state. */
  const revealOpts = useRef({
    portrait,
    img: null as HTMLImageElement | null,
    feathered: null as HTMLCanvasElement | null,
    calib,
    fullPreview,
    showLabels,
    softEdges,
  })

  /** Single write path so the render loop (ref) and React (state) never disagree. */
  const commit = useCallback((fn: (prev: Item[]) => Item[]) => {
    const next = fn(itemsRef.current)
    if (next === itemsRef.current) return
    itemsRef.current = next
    setItems(next)
  }, [])

  useEffect(() => {
    showLandmarksRef.current = showLandmarks
  }, [showLandmarks])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    Object.assign(revealOpts.current, { portrait, calib, fullPreview, showLabels, softEdges })
  }, [portrait, calib, fullPreview, showLabels, softEdges])

  // Decode the portrait once so the canvas can draw it every frame.
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      revealOpts.current.img = img
      revealOpts.current.feathered = featherPortrait(img)
    }
    img.src = portrait.src
    return () => {
      cancelled = true
    }
  }, [portrait.src])

  // Face model loads only once Anime Reveal is opened.
  useEffect(() => {
    if (mode !== 'anime' || faceLandmarkerRef.current || unsupportedReason()) return
    let cancelled = false
    setFaceModel('loading')
    loadFaceLandmarker().then(
      (l) => {
        faceLandmarkerRef.current = l
        if (!cancelled) setFaceModel('ready')
      },
      (err: Error) => {
        if (cancelled) return
        setFaceModel('error')
        setError(err.message)
      },
    )
    return () => {
      cancelled = true
    }
  }, [mode])

  // Stage size tracking.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      stageSize.current = { w: entry.contentRect.width, h: entry.contentRect.height }
      setViewport(stageSize.current)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Preload the hand model in the background (local files only — no camera involved).
  useEffect(() => {
    if (unsupportedReason()) return
    loadHandLandmarker().then(
      () => setModel('ready'),
      () => setModel('error'),
    )
  }, [])

  const toast = useCallback((msg: string) => setNotice(msg), [])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3200)
    return () => clearTimeout(t)
  }, [notice])

  // ---------- preview ----------

  const openPreview = useCallback((id: string, viaKeyboard = false) => {
    previewIdRef.current = id
    setPreview({ id, closing: false, viaKeyboard })
  }, [])

  const closePreview = useCallback(() => {
    if (!previewIdRef.current) return
    previewIdRef.current = null
    setPreview((p) => (p && !p.closing ? { ...p, closing: true } : p))
  }, [])

  /** Tap or click on an image: open its preview, or close it if it's the one already open. */
  const togglePreview = useCallback(
    (id: string, viaKeyboard = false) => (previewIdRef.current === id ? closePreview() : openPreview(id, viaKeyboard)),
    [openPreview, closePreview],
  )

  // Finish the fade-out, then unmount (and hand focus back if the keyboard opened it).
  useEffect(() => {
    if (!preview?.closing) return
    const t = setTimeout(() => {
      setPreview((p) => (p?.closing ? null : p))
      if (preview.viaKeyboard) stageRef.current?.querySelector<HTMLElement>(`[data-id="${preview.id}"]`)?.focus()
    }, PREVIEW_EXIT_MS)
    return () => clearTimeout(t)
  }, [preview])

  useEffect(() => {
    if (preview?.viaKeyboard && !preview.closing) previewCloseRef.current?.focus()
  }, [preview?.id, preview?.viaKeyboard, preview?.closing])

  // The previewed image was removed.
  useEffect(() => {
    if (preview && !items.some((it) => it.id === preview.id)) closePreview()
  }, [items, preview, closePreview])

  /** Gesture taps: the close button wins, then the card itself (ignored), then images; empty space closes. */
  const handleTaps = useCallback(
    (taps: Tap[]) => {
      for (const tap of taps) {
        if (previewIdRef.current && inRect(stageRect(previewCloseRef.current, 10), tap.point)) closePreview()
        else if (previewIdRef.current && inRect(stageRect(previewCardRef.current), tap.point)) continue
        else if (tap.itemId) togglePreview(tap.itemId)
        else closePreview()
      }
    },
    [closePreview, togglePreview],
  )

  // ---------- gesture pipeline ----------

  const lastSelFromEngine = useRef<string | null>(null)
  const lastSummaryKey = useRef('')

  const publishSummary = useCallback((hands: HandStatus[]) => {
    const phases = hands.map((h) => h.phase)
    const action: Summary['action'] = phases.includes('resizing')
      ? 'resizing'
      : phases.includes('dragging')
        ? 'dragging'
        : phases.includes('pinching-empty')
          ? 'pinching'
          : null
    const hoverIds = hands
      .filter((h) => h.phase === 'open' && !h.lost)
      .map((h) => h.hoverId)
      .filter((id): id is string => !!id)
    const heldIds = [...new Set(hands.map((h) => h.itemId).filter((id): id is string => !!id))]
    const next: Summary = { hands: hands.filter((h) => !h.lost).length, action, lost: hands.some((h) => h.lost), hoverIds, heldIds }
    const key = JSON.stringify(next)
    if (key !== lastSummaryKey.current) {
      lastSummaryKey.current = key
      setSummary(next)
    }
  }, [])


  const publishReveal = useCallback((next: RevealSummary) => {
    const key = JSON.stringify(next)
    if (key !== lastRevealKey.current) {
      lastRevealKey.current = key
      setRevealSummary(next)
    }
  }, [])

  /** Feeds one frame of hands (and, in Anime Reveal, a face) through the pipeline. Shared by camera and test hook. */
  const processFrames = useCallback(
    (frames: HandFrame[], now: number, face: FaceFrame | null = null) => {
      if (modeRef.current === 'anime') {
        const st = revealRef.current.step(frames, face, now)
        const o = revealOpts.current
        const matrix = st.face && o.img ? faceMatrix(st.face, o.portrait.anchors, { w: o.img.naturalWidth, h: o.img.naturalHeight }, o.calib) : null
        const statuses = toStatuses(frames)
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) {
          beginFrame(ctx, stageSize.current)
          drawReveal(ctx, st, { img: o.softEdges ? o.feathered : o.img, matrix, opacity: o.calib.opacity, showLabels: o.showLabels, fullPreview: o.fullPreview })
          drawOverlay(ctx, stageSize.current, frames, statuses, HAND_CONNECTIONS, showLandmarksRef.current, false)
        }
        publishSummary(statuses)
        publishReveal({ face: !!st.face, window: !!st.window && st.windowAlpha > 0 })
        return
      }
      const engine = engineRef.current
      // An open preview covers whatever is underneath it.
      const card = previewIdRef.current ? stageRect(previewCardRef.current) : null
      const res = engine.step(frames, now, itemsRef.current, { blockers: card ? [card] : [] })
      if (res.changed) commit(() => res.items)
      if (res.taps.length) handleTaps(res.taps)
      const closeBtn = previewCloseRef.current
      if (closeBtn) {
        const r = stageRect(closeBtn, 10)
        closeBtn.classList.toggle('tip-hover', res.hands.some((h) => !h.pinched && !h.lost && inRect(r, h.tip)))
      }
      if (res.selectedId && res.selectedId !== lastSelFromEngine.current) {
        lastSelFromEngine.current = res.selectedId
        setSelectedId(res.selectedId)
      }
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) drawOverlay(ctx, stageSize.current, frames, res.hands, HAND_CONNECTIONS, showLandmarksRef.current)
      publishSummary(res.hands)
    },
    [commit, publishSummary, publishReveal, handleTaps],
  )

  const stopAll = useCallback(() => {
    stopCamera(videoRef.current, streamRef.current)
    streamRef.current = null
    engineRef.current.reset()
    revealRef.current.reset()
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    lastSummaryKey.current = ''
    lastRevealKey.current = ''
    setSummary(EMPTY_SUMMARY)
    setRevealSummary(EMPTY_REVEAL)
    setCamera('idle')
  }, [])

  // Detection loop while the camera runs.
  useEffect(() => {
    if (camera !== 'running') return
    let raf = 0
    let cancelled = false
    let lastVideoTime = -1
    let lastFrameAt = performance.now()
    let landmarker: Awaited<ReturnType<typeof loadHandLandmarker>> | null = null
    loadHandLandmarker().then((l) => (landmarker = l))

    const tick = () => {
      if (cancelled) return
      const video = videoRef.current
      const now = performance.now()
      if (landmarker && video && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime
        lastFrameAt = now
        try {
          const videoSize = { w: video.videoWidth, h: video.videoHeight }
          const result = landmarker.detectForVideo(video, now)
          const frames = toHandFrames(result, videoSize, stageSize.current)
          const faceLandmarker = modeRef.current === 'anime' ? faceLandmarkerRef.current : null
          const face = faceLandmarker
            ? faceFrameFromLandmarks(faceLandmarker.detectForVideo(video, now).faceLandmarks[0], videoSize, stageSize.current)
            : null
          processFrames(frames, now, face)
        } catch (err) {
          console.error('[hand-tracker] detection failed', err)
          setError('Hand tracking stopped unexpectedly. Press Start camera to try again.')
          stopAll()
          return
        }
      } else if (now - lastFrameAt > 400) {
        // Camera stalled — let the engine release anything held.
        processFrames([], now)
        lastFrameAt = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [camera, processFrames, stopAll])

  const handleStartCamera = async () => {
    if (camera === 'running') return stopAll()
    setError(null)
    const unsupported = unsupportedReason()
    if (unsupported) return setError(unsupported.message)
    setCamera('starting')
    try {
      // Model first: no point asking for the camera if tracking can't run.
      setModel((m) => (m === 'ready' ? m : 'loading'))
      await loadHandLandmarker()
      setModel('ready')
      streamRef.current = await startCamera(videoRef.current!)
      streamRef.current.getVideoTracks()[0]?.addEventListener('ended', () => {
        setError('The camera was disconnected. Your layout is kept — press Start camera to resume.')
        stopAll()
      })
      setCamera('running')
    } catch (err) {
      if (err instanceof TrackerError && err.kind === 'model') setModel('error')
      setError(err instanceof Error ? err.message : 'Something went wrong starting the camera.')
      stopAll()
    }
  }

  useEffect(() => () => stopCamera(videoRef.current, streamRef.current), [])

  // ---------- uploads ----------

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = [...files]
      const valid = list.filter((f) => ACCEPTED.includes(f.type))
      let skipped = list.length - valid.length
      const stage = stageSize.current
      const added: Item[] = []
      for (const [i, file] of valid.entries()) {
        const src = URL.createObjectURL(file)
        try {
          const { w, h } = await loadImageSize(src)
          const aspect = h / w
          added.push({
            id: newId(),
            src,
            name: file.name,
            aspect,
            baseWidth: baseWidthFor(aspect, stage.w),
            x: stage.w / 2 + (i % 5) * 36 - 72,
            y: stage.h / 2 + (i % 5) * 28 - 56,
            scale: 1,
            rotation: 0,
            z: 0,
            isObjectUrl: true,
          })
        } catch {
          URL.revokeObjectURL(src)
          skipped++
        }
      }
      if (added.length) {
        commit((prev) => {
          let z = Math.max(0, ...prev.map((it) => it.z))
          return [...prev, ...added.map((it) => ({ ...it, z: ++z }))]
        })
        setSelectedId(added[added.length - 1].id)
      }
      if (skipped) toast(`Skipped ${skipped} file${skipped > 1 ? 's' : ''} — only JPG, PNG and WebP images are supported.`)
      else if (added.length) toast(`Added ${added.length} image${added.length > 1 ? 's' : ''}`)
    },
    [commit, toast],
  )

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = ''
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const removeItem = useCallback(
    (id: string) => {
      const it = itemsRef.current.find((i) => i.id === id)
      if (!it) return
      if (it.isObjectUrl) URL.revokeObjectURL(it.src)
      commit((prev) => prev.filter((i) => i.id !== id))
      setSelectedId((s) => (s === id ? null : s))
    },
    [commit],
  )

  const resetLayout = () => commit((prev) => gridLayout(prev, stageSize.current, galleryRegion(stageSize.current)))

  // ---------- anime reveal ----------

  const switchMode = useCallback(
    (next: Mode) => {
      if (next === modeRef.current) return
      // Drop anything held so nothing moves while its mode is hidden.
      engineRef.current.reset()
      revealRef.current.reset()
      modeRef.current = next
      setMode(next)
      setSelectedId(null)
      previewIdRef.current = null
      setPreview(null)
      lastSummaryKey.current = ''
      lastRevealKey.current = ''
      setSummary(EMPTY_SUMMARY)
      setRevealSummary(EMPTY_REVEAL)
      const ctx = canvasRef.current?.getContext('2d')
      ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    },
    [],
  )

  const replacePortrait = (next: Portrait) =>
    setPortrait((prev) => {
      if (prev.isObjectUrl) URL.revokeObjectURL(prev.src)
      return next
    })

  const autoAlign = async (src: string) => {
    setDetect('running')
    try {
      const img = new Image()
      img.src = src
      await img.decode()
      const anchors = await detectPortraitAnchors(img)
      if (anchors) setPortrait((p) => (p.src === src ? { ...p, anchors } : p))
      setDetect(anchors ? 'found' : 'missed')
    } catch (err) {
      console.warn('[anime-reveal] portrait detection failed', err)
      setDetect('error')
    }
  }

  const uploadPortrait = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) return toast('Portraits must be JPG, PNG or WebP images.')
    const src = URL.createObjectURL(file)
    try {
      await loadImageSize(src)
    } catch {
      URL.revokeObjectURL(src)
      return toast('That image couldn’t be read.')
    }
    replacePortrait({ src, name: file.name, anchors: DEFAULT_ANCHORS, isObjectUrl: true })
    setCalib(DEFAULT_CALIBRATION)
    autoAlign(src)
  }

  const loadSamplePortrait = () => {
    replacePortrait({ ...SAMPLE_PORTRAIT })
    setCalib(DEFAULT_CALIBRATION)
    setDetect('idle')
  }

  // ---------- mouse fallback ----------

  const pointer = useRef<
    | { mode: 'drag'; id: string; offset: Vec2; pid: number; down: Vec2; at: number; moved: number }
    | { mode: 'handle'; id: string; v0: Vec2; s0: number; r0: number; pid: number }
    | null
  >(null)

  const toStage = (e: { clientX: number; clientY: number }): Vec2 => {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const bringToFront = (id: string) =>
    commit((prev) => {
      const maxZ = Math.max(0, ...prev.map((it) => it.z))
      const cur = prev.find((it) => it.id === id)
      if (!cur || cur.z === maxZ) return prev
      return prev.map((it) => (it.id === id ? { ...it, z: maxZ + 1 } : it))
    })

  const onItemPointerDown = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const it = itemsRef.current.find((i) => i.id === id)
    if (!it) return
    const p = toStage(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointer.current = { mode: 'drag', id, offset: { x: it.x - p.x, y: it.y - p.y }, pid: e.pointerId, down: p, at: e.timeStamp, moved: 0 }
    setSelectedId(id)
    bringToFront(id)
  }

  const onHandlePointerDown = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const it = itemsRef.current.find((i) => i.id === id)
    if (!it) return
    const p = toStage(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointer.current = { mode: 'handle', id, v0: { x: p.x - it.x, y: p.y - it.y }, s0: it.scale, r0: it.rotation, pid: e.pointerId }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const ptr = pointer.current
    if (!ptr || ptr.pid !== e.pointerId) return
    const p = toStage(e)
    if (ptr.mode === 'drag') ptr.moved = Math.max(ptr.moved, dist(p, ptr.down))
    commit((prev) =>
      prev.map((it) => {
        if (it.id !== ptr.id) return it
        if (ptr.mode === 'drag') return { ...it, x: p.x + ptr.offset.x, y: p.y + ptr.offset.y }
        const v = { x: p.x - it.x, y: p.y - it.y }
        const origin = { x: 0, y: 0 }
        const scale = Math.min(8, Math.max(0.12, (ptr.s0 * dist(origin, v)) / Math.max(dist(origin, ptr.v0), 1)))
        const rotation = e.shiftKey ? ptr.r0 : ptr.r0 + angle(origin, v) - angle(origin, ptr.v0)
        return { ...it, scale, rotation }
      }),
    )
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const ptr = pointer.current
    if (ptr?.pid !== e.pointerId) return
    pointer.current = null
    // A click (short, barely moved) previews; anything more was a drag.
    if (e.type === 'pointerup' && ptr.mode === 'drag' && ptr.moved < 6 && e.timeStamp - ptr.at < 500) togglePreview(ptr.id)
  }

  const onItemKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    setSelectedId(id)
    togglePreview(id, true)
  }

  // Wheel: resize; Shift+wheel: rotate. Non-passive so we can stop page zoom/scroll.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (modeRef.current !== 'playground') return
      const r = el.getBoundingClientRect()
      const target = topItemAt(itemsRef.current, { x: e.clientX - r.left, y: e.clientY - r.top })
      if (!target) return
      e.preventDefault()
      const delta = e.deltaY || e.deltaX
      commit((prev) =>
        prev.map((it) => {
          if (it.id !== target.id) return it
          if (e.shiftKey) return { ...it, rotation: it.rotation + delta * 0.004 }
          return { ...it, scale: Math.min(8, Math.max(0.12, it.scale * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)))) }
        }),
      )
      setSelectedId(target.id)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [commit])

  // ---------- presentation & shortcuts ----------

  const enterPresentation = () => {
    setPresenting(true)
    setGuideOpen(false)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  const exitPresentation = useCallback(() => {
    setPresenting(false)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setPresenting(false)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (!presenting) return
    let t = setTimeout(() => setIdle(true), 1800)
    const onMove = () => {
      setIdle(false)
      clearTimeout(t)
      t = setTimeout(() => setIdle(true), 1800)
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousemove', onMove)
    }
  }, [presenting])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'escape' && previewIdRef.current) closePreview()
      else if (k === 'escape' && presenting) exitPresentation()
      else if (k === 'p') (presenting ? exitPresentation : enterPresentation)()
      else if (k === 'h' && !presenting) setControlsHidden((v) => !v)
      else if (k === 'l') setShowLandmarks((v) => !v)
      else if (k === 'm') switchMode(modeRef.current === 'anime' ? 'playground' : 'anime')
      else if ((k === 'delete' || k === 'backspace') && selectedId && !presenting && modeRef.current === 'playground') {
        e.preventDefault()
        removeItem(selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [presenting, selectedId, removeItem, exitPresentation, switchMode, closePreview])

  // Dev-only hook: drive the real gesture pipeline with synthetic hands (used for automated browser checks).
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __playground?: unknown }
    w.__playground = {
      feed: (frames: HandFrame[], now = performance.now(), face: FaceFrame | null = null) => processFrames(frames, now, face),
      items: () => itemsRef.current,
      stage: () => stageSize.current,
      mode: () => modeRef.current,
      portrait: () => ({ ...revealOpts.current.portrait, loaded: !!revealOpts.current.img }),
    }
  }, [processFrames])

  const dismissGuide = () => {
    setGuideOpen(false)
    writeFlag(GUIDE_KEY, true)
  }
  const toggleGuide = () => {
    setGuideOpen((v) => !v)
    writeFlag(GUIDE_KEY, guideOpen)
  }

  // ---------- render ----------

  const statusChips = useMemo(() => {
    const chips: { label: string; tone: 'dim' | 'ok' | 'active' | 'warn' }[] = []
    const anime = mode === 'anime'
    const handsActive = summary.hands > 0 || summary.lost || summary.action !== null || (anime && (revealSummary.face || revealSummary.window))
    if (camera === 'idle' && !handsActive) {
      if (anime) chips.push({ label: faceModel === 'loading' ? 'Camera off · loading face model' : 'Camera off', tone: 'dim' })
      else chips.push({ label: model === 'loading' ? 'Mouse mode · loading hand model' : 'Mouse mode', tone: 'dim' })
    } else if (camera === 'starting') {
      chips.push({ label: model === 'ready' ? 'Waiting for camera…' : 'Loading hand model…', tone: 'dim' })
    } else {
      chips.push(
        summary.hands === 0
          ? { label: 'No hands detected', tone: 'dim' }
          : { label: summary.hands === 2 ? '2 hands detected' : 'Hand detected', tone: 'ok' },
      )
      if (mode === 'anime') {
        if (faceModel === 'loading') chips.push({ label: 'Loading face model…', tone: 'dim' })
        else chips.push(revealSummary.face ? { label: 'Face tracked', tone: 'ok' } : { label: 'No face detected', tone: camera === 'running' ? 'warn' : 'dim' })
        chips.push(revealSummary.window ? { label: 'Revealing', tone: 'active' } : { label: 'Show both hands to open the window', tone: 'dim' })
        return chips
      }
      if (summary.action === 'resizing') chips.push({ label: 'Resizing', tone: 'active' })
      else if (summary.action === 'dragging') chips.push({ label: 'Dragging', tone: 'active' })
      else if (summary.action === 'pinching') chips.push({ label: 'Pinch', tone: 'dim' })
      if (summary.lost) chips.push({ label: 'Tracking lost', tone: 'warn' })
    }
    return chips
  }, [camera, model, summary, mode, faceModel, revealSummary])

  const previewIndex = preview && mode === 'playground' ? items.findIndex((it) => it.id === preview.id) : -1
  const previewItem = previewIndex >= 0 ? { item: items[previewIndex], index: previewIndex } : null
  const hover = new Set(summary.hoverIds)
  const held = new Set(summary.heldIds)

  return (
    <div className={`app mode-${mode}${presenting ? ' presenting' : ''}${presenting && idle ? ' idle' : ''}`}>
      <div
        ref={stageRef}
        className={`stage${camera === 'running' ? ' live' : ''}${dragOver ? ' drag-over' : ''}`}
        onPointerDown={() => {
          setSelectedId(null)
          closePreview()
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <video ref={videoRef} className="camera" playsInline muted aria-hidden="true" />
        {camera !== 'running' && !presenting && (
          <div className="empty-hint">
            <HandIcon />
            <span>
              {mode === 'anime'
                ? 'Start the camera — Anime Reveal needs your face and both hands in view.'
                : 'Start the camera to use hand gestures — or drag the cards with your mouse.'}
            </span>
          </div>
        )}

        {mode === 'playground' && (
          <div className="intro">
            <p className="intro-title">
              A little wave.
              <br />
              <span>A closer look.</span>
            </p>
            <p className="intro-body">Point at an image, then pinch and release to take a peek.</p>
          </div>
        )}

        <div className="items" hidden={mode !== 'playground'}>
          {items.map((it, i) => {
            const { w, h } = itemSize(it)
            const selected = it.id === selectedId && !presenting
            return (
              <div
                key={it.id}
                className={`item${selected ? ' selected' : ''}${hover.has(it.id) ? ' hover' : ''}${held.has(it.id) ? ' held' : ''}${preview?.id === it.id && !preview.closing ? ' previewing' : ''}`}
                style={{
                  width: w,
                  height: h,
                  zIndex: it.z,
                  transform: `translate(${it.x - w / 2}px, ${it.y - h / 2}px) rotate(${it.rotation}rad)`,
                }}
                onPointerDown={(e) => onItemPointerDown(e, it.id)}
                onKeyDown={(e) => onItemKeyDown(e, it.id)}
                tabIndex={mode === 'playground' ? 0 : -1}
                role="button"
                aria-label={`Preview ${previewTitle(it, i)}`}
                aria-haspopup="dialog"
                aria-expanded={preview?.id === it.id && !preview.closing}
                data-id={it.id}
              >
                <img src={it.src} alt={it.name} draggable={false} />
                {selected && (
                  <>
                    <button
                      className="item-remove"
                      aria-label={`Remove ${it.name}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => removeItem(it.id)}
                    >
                      <CloseIcon />
                    </button>
                    <span
                      className="item-handle"
                      title="Drag to resize and rotate (hold Shift to keep angle)"
                      onPointerDown={(e) => onHandlePointerDown(e, it.id)}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>

        <canvas ref={canvasRef} className="overlay" aria-hidden="true" />
      </div>

      {previewItem && (
        <ImagePreview
          key={previewItem.item.id}
          src={previewItem.item.src}
          title={previewTitle(previewItem.item, previewItem.index)}
          layout={previewLayout(previewItem.item, viewport, presenting || controlsHidden ? 12 : 80)}
          closing={!!preview?.closing}
          onClose={closePreview}
          cardRef={previewCardRef}
          closeRef={previewCloseRef}
        />
      )}

      {!presenting && (
        <>
          <div className="status" role="status" aria-live="polite">
            {statusChips.map((c) => (
              <span key={c.label} className={`chip ${c.tone}`}>
                <i />
                {c.label}
              </span>
            ))}
          </div>

          {controlsHidden ? (
            <button className="toolbar-reveal" onClick={() => setControlsHidden(false)} title="Show controls (H)">
              <ShowIcon /> Controls
            </button>
          ) : (
            <nav className="toolbar" aria-label="Toolbar">
              <div className="segmented" role="tablist" aria-label="Mode">
                <button role="tab" aria-selected={mode === 'playground'} className={mode === 'playground' ? 'on' : ''} onClick={() => switchMode('playground')} title="Photo playground (M)">
                  Playground
                </button>
                <button role="tab" aria-selected={mode === 'anime'} className={mode === 'anime' ? 'on' : ''} onClick={() => switchMode('anime')} title="Anime Reveal (M)">
                  Anime Reveal
                </button>
              </div>
              <span className="sep" />
              <button className={`btn primary${camera === 'running' ? ' on' : ''}`} onClick={handleStartCamera} disabled={camera === 'starting'}>
                {camera === 'running' ? <StopIcon /> : <CameraIcon />}
                {camera === 'running' ? 'Stop camera' : camera === 'starting' ? 'Starting…' : 'Start camera'}
              </button>
              {mode === 'playground' && (
                <>
                  <button className="btn" onClick={() => fileRef.current?.click()}>
                    <UploadIcon /> Upload images
                  </button>
                  <button className="btn" onClick={resetLayout}>
                    <GridIcon /> Reset layout
                  </button>
                </>
              )}
              <span className="sep" />
              <button className={`btn icon${showLandmarks ? ' on' : ''}`} onClick={() => setShowLandmarks((v) => !v)} title="Toggle hand landmarks (L)" aria-pressed={showLandmarks}>
                <HandIcon />
              </button>
              {mode === 'playground' && (
                <button className={`btn icon${guideOpen ? ' on' : ''}`} onClick={toggleGuide} title="Gesture guide" aria-pressed={guideOpen}>
                  <HelpIcon />
                </button>
              )}
              <button className="btn icon" onClick={enterPresentation} title="Presentation mode (P)">
                <PresentIcon />
              </button>
              <button className="btn icon" onClick={() => setControlsHidden(true)} title="Hide controls (H)">
                <HideIcon />
              </button>
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple hidden onChange={onFileInput} />
            </nav>
          )}

          {guideOpen && mode === 'playground' && <GestureGuide onClose={dismissGuide} />}
          {mode === 'anime' && !controlsHidden && (
            <AnimePanel
              portrait={portrait}
              calib={calib}
              onCalib={setCalib}
              onAnchors={(anchors) => setPortrait((p) => ({ ...p, anchors }))}
              onUpload={uploadPortrait}
              onSample={loadSamplePortrait}
              onDetect={() => autoAlign(portrait.src)}
              detect={detect}
              fullPreview={fullPreview}
              onFullPreview={setFullPreview}
              showLabels={showLabels}
              onShowLabels={setShowLabels}
              softEdges={softEdges}
              onSoftEdges={setSoftEdges}
              onResetCalib={() => setCalib(DEFAULT_CALIBRATION)}
            />
          )}

          {error && (
            <div className="banner" role="alert">
              <span>{error}</span>
              <button className="icon-btn" onClick={() => setError(null)} aria-label="Dismiss">
                <CloseIcon />
              </button>
            </div>
          )}
          {notice && <div className="toast">{notice}</div>}
          <p className="privacy">Camera frames are processed on this device and never uploaded or stored.</p>
        </>
      )}

      {presenting && (
        <button className="exit-present" onClick={exitPresentation}>
          Exit presentation · Esc
        </button>
      )}
    </div>
  )
}
