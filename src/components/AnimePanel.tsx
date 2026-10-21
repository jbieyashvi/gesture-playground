import { useRef, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { Anchors, Calibration } from '../lib/reveal'
import { UploadIcon } from './Icons'

export type DetectState = 'idle' | 'running' | 'found' | 'missed' | 'error'

interface Props {
  portrait: { src: string; name: string; anchors: Anchors } | null
  calib: Calibration
  onCalib: (c: Calibration) => void
  onAnchors: (a: Anchors) => void
  onUpload: (file: File) => void
  onSample: () => void
  onDetect: () => void
  detect: DetectState
  fullPreview: boolean
  onFullPreview: (on: boolean) => void
  showLabels: boolean
  onShowLabels: (on: boolean) => void
  softEdges: boolean
  onSoftEdges: (on: boolean) => void
  onResetCalib: () => void
}

const MARKERS: { key: keyof Anchors; label: string }[] = [
  { key: 'leftEye', label: 'Eye' },
  { key: 'rightEye', label: 'Eye' },
  { key: 'mouth', label: 'Mouth' },
]

const DETECT_TEXT: Record<DetectState, string> = {
  idle: 'Drag the markers onto the portrait’s eyes and mouth.',
  running: 'Looking for a face in the portrait…',
  found: 'Markers placed from face landmarks. Fine-tune if needed.',
  missed: 'No face found automatically (common for anime art). Drag the markers instead.',
  error: 'Couldn’t run face detection. Drag the markers instead.',
}

export function AnimePanel(p: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drag = useRef<{ key: keyof Anchors; pid: number } | null>(null)

  const onMarkerDown = (e: ReactPointerEvent, key: keyof Anchors) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { key, pid: e.pointerId }
  }
  const onMarkerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    const box = boxRef.current
    if (!d || d.pid !== e.pointerId || !box || !p.portrait) return
    const r = box.getBoundingClientRect()
    const clamp = (v: number) => Math.min(1, Math.max(0, v))
    p.onAnchors({ ...p.portrait.anchors, [d.key]: { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) } })
  }
  const onMarkerUp = (e: ReactPointerEvent) => {
    if (drag.current?.pid === e.pointerId) drag.current = null
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) p.onUpload(f)
    e.target.value = ''
  }

  const slider = (key: keyof Calibration, label: string, min: number, max: number, step: number, fmt: (v: number) => string) => (
    <label className="slider">
      <span>
        {label}
        <output>{fmt(p.calib[key])}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={p.calib[key]} onChange={(e) => p.onCalib({ ...p.calib, [key]: Number(e.target.value) })} />
    </label>
  )

  return (
    <aside className="anime-panel" aria-label="Anime Reveal settings">
      <header>
        <span>Anime Reveal</span>
      </header>
      <p className="anime-note">
        Overlays an <b>uploaded anime portrait</b> aligned to your face. It doesn’t generate anime from your camera.
      </p>
      <p className="anime-hint">Hold up both hands — your thumb–index points become opposite corners of the reveal window.</p>

      {p.portrait ? (
        <>
          <div className="portrait" ref={boxRef}>
            <img src={p.portrait.src} alt={p.portrait.name} draggable={false} />
            {MARKERS.map((m) => (
              <span
                key={m.key}
                className={`marker ${m.key}`}
                style={{ left: `${p.portrait!.anchors[m.key].x * 100}%`, top: `${p.portrait!.anchors[m.key].y * 100}%` }}
                onPointerDown={(e) => onMarkerDown(e, m.key)}
                onPointerMove={onMarkerMove}
                onPointerUp={onMarkerUp}
                onPointerCancel={onMarkerUp}
                title={`Drag onto the portrait’s ${m.key === 'mouth' ? 'mouth' : 'eye'}`}
                data-marker={m.key}
              >
                <i>{m.label}</i>
              </span>
            ))}
          </div>
          <p className="anime-hint">{DETECT_TEXT[p.detect]}</p>
        </>
      ) : (
        <p className="anime-hint">Upload a front-facing anime portrait to start.</p>
      )}

      <div className="row">
        <button className="btn small" onClick={() => fileRef.current?.click()}>
          <UploadIcon /> Upload portrait
        </button>
        <button className="btn small" onClick={p.onDetect} disabled={!p.portrait || p.detect === 'running'}>
          Auto-align
        </button>
        <button className="btn small" onClick={p.onSample}>
          Sample
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onChange={onFile} />

      <div className="sliders">
        {slider('dx', 'Offset X', -1, 1, 0.01, (v) => v.toFixed(2))}
        {slider('dy', 'Offset Y', -1, 1, 0.01, (v) => v.toFixed(2))}
        {slider('scale', 'Scale', 0.5, 2, 0.01, (v) => `${v.toFixed(2)}×`)}
        {slider('opacity', 'Opacity', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}
      </div>

      <label className="toggle">
        <input type="checkbox" checked={p.fullPreview} onChange={(e) => p.onFullPreview(e.target.checked)} />
        Calibrate: show full overlay
      </label>
      <label className="toggle">
        <input type="checkbox" checked={p.softEdges} onChange={(e) => p.onSoftEdges(e.target.checked)} />
        Soft portrait edges
      </label>
      <label className="toggle">
        <input type="checkbox" checked={p.showLabels} onChange={(e) => p.onShowLabels(e.target.checked)} />
        Tracking labels
      </label>
      <button className="btn small link" onClick={p.onResetCalib}>
        Reset calibration
      </button>
    </aside>
  )
}
