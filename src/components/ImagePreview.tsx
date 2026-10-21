import type { Ref } from 'react'
import type { PreviewLayout } from '../lib/preview'
import { CloseIcon } from './Icons'

interface Props {
  src: string
  title: string
  layout: PreviewLayout
  closing: boolean
  onClose: () => void
  cardRef: Ref<HTMLDivElement>
  closeRef: Ref<HTMLButtonElement>
}

/** Compact floating preview card shown beside the tapped image. Non-modal: the gallery stays usable. */
export function ImagePreview({ src, title, layout, closing, onClose, cardRef, closeRef }: Props) {
  return (
    <div
      ref={cardRef}
      className={`preview side-${layout.side}${closing ? ' closing' : ''}`}
      role="dialog"
      aria-label={`Preview: ${title}`}
      style={{ left: layout.x, top: layout.y, width: layout.w }}
    >
      <div className="preview-img" style={{ height: layout.imgH }}>
        <img src={src} alt={title} draggable={false} style={{ width: layout.imgW, height: layout.imgH }} />
      </div>
      <div className="preview-bar">
        <span className="preview-title" title={title}>
          {title}
        </span>
        <button ref={closeRef} className="icon-btn preview-close" onClick={onClose} aria-label="Close preview">
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
