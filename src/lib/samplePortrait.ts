import type { Anchors } from './reveal'

// A hand-drawn, front-facing anime portrait (480×600) so Anime Reveal works before you upload your own.
// Eye centres sit at (176, 318) and (304, 318); the mouth at (240, 450).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" width="480" height="600">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2d5c"/><stop offset="1" stop-color="#f3a3b5"/></linearGradient>
  <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2f6b"/><stop offset="1" stop-color="#17142e"/></linearGradient>
  <linearGradient id="iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26165f"/><stop offset=".55" stop-color="#5b3fd6"/><stop offset="1" stop-color="#c9a2ff"/></linearGradient>
  <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde6d6"/><stop offset="1" stop-color="#f6d0bb"/></linearGradient>
</defs>
<rect width="480" height="600" fill="url(#bg)"/>
<path d="M95 300 C70 140 170 70 250 75 C350 80 420 160 390 330 C385 420 400 500 380 560 L100 560 C85 480 100 400 95 300Z" fill="url(#hair)"/>
<path d="M205 470 L275 470 L282 560 L198 560Z" fill="#efc2a8"/>
<path d="M60 600 C80 540 160 520 240 545 C320 520 400 540 420 600Z" fill="#f4f1fb"/>
<path d="M190 548 L240 590 L290 548" fill="none" stroke="#5b3fd6" stroke-width="6"/>
<ellipse cx="128" cy="330" rx="12" ry="22" fill="#f6d0bb"/>
<ellipse cx="352" cy="330" rx="12" ry="22" fill="#f6d0bb"/>
<path d="M130 265 C130 175 350 175 350 265 C350 375 305 465 240 500 C175 465 130 375 130 265Z" fill="url(#skin)"/>
<ellipse cx="158" cy="390" rx="22" ry="11" fill="#ff8fa3" opacity=".35"/>
<ellipse cx="322" cy="390" rx="22" ry="11" fill="#ff8fa3" opacity=".35"/>
<g id="eye">
  <ellipse cx="176" cy="322" rx="31" ry="25" fill="#fff"/>
  <ellipse cx="177" cy="324" rx="20" ry="24" fill="url(#iris)"/>
  <ellipse cx="177" cy="326" rx="9" ry="12" fill="#140c33"/>
  <circle cx="169" cy="312" r="6.5" fill="#fff"/>
  <circle cx="186" cy="335" r="3" fill="#fff" opacity=".85"/>
  <path d="M141 310 Q176 280 214 302" fill="none" stroke="#1b1530" stroke-width="6.5" stroke-linecap="round"/>
  <path d="M152 345 Q176 352 200 345" fill="none" stroke="#1b1530" stroke-width="1.6" opacity=".5"/>
  <path d="M150 268 Q176 256 204 264" fill="none" stroke="#2a2148" stroke-width="3.5" stroke-linecap="round"/>
</g>
<use href="#eye" transform="translate(480 0) scale(-1 1)"/>
<path d="M240 385 L235 402 L243 403" fill="none" stroke="#d99a86" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M225 446 Q240 460 255 446 Q240 452 225 446Z" fill="#c4566b" stroke="#a24a5a" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M118 290 C105 150 200 105 262 110 C345 115 385 190 368 292 L348 240 L333 276 L307 214 L287 262 L258 200 L242 258 L216 206 L192 264 L170 216 L150 270 L136 232Z" fill="url(#hair)"/>
<path d="M120 270 C112 360 118 430 140 500 C128 420 132 350 146 290Z" fill="url(#hair)"/>
<path d="M360 270 C368 360 362 430 340 500 C352 420 348 350 334 290Z" fill="url(#hair)"/>
<path d="M200 140 C230 130 270 132 300 150" fill="none" stroke="#8d7ce8" stroke-width="5" stroke-linecap="round" opacity=".55"/>
</svg>`

export const SAMPLE_PORTRAIT = {
  name: 'Sample anime portrait',
  src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  anchors: {
    leftEye: { x: 176 / 480, y: 318 / 600 },
    rightEye: { x: 304 / 480, y: 318 / 600 },
    mouth: { x: 240 / 480, y: 450 / 600 },
  } satisfies Anchors,
}

/** Typical proportions for a front-facing portrait — a starting point before manual tweaks. */
export const DEFAULT_ANCHORS: Anchors = {
  leftEye: { x: 0.37, y: 0.45 },
  rightEye: { x: 0.63, y: 0.45 },
  mouth: { x: 0.5, y: 0.66 },
}
