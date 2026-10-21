import { CloseIcon } from './Icons'

export function GestureGuide({ onClose }: { onClose: () => void }) {
  return (
    <aside className="guide" aria-label="Gesture guide">
      <header>
        <span>Gestures</span>
        <button className="icon-btn" onClick={onClose} aria-label="Dismiss gesture guide">
          <CloseIcon />
        </button>
      </header>
      <ul>
        <li>
          <b>Peek</b> Point at an image, then pinch and release quickly
        </li>
        <li>
          <b>Grab</b> Pinch thumb + index on an image
        </li>
        <li>
          <b>Move</b> Keep pinching and move your hand
        </li>
        <li>
          <b>Drop</b> Open your fingers
        </li>
        <li>
          <b>Resize / rotate</b> Pinch the same image with both hands, then spread or twist
        </li>
      </ul>
      <p className="guide-mouse">
        Mouse: click to preview · drag to move · scroll to resize · Shift+scroll or corner handle to rotate · Delete removes
      </p>
    </aside>
  )
}
