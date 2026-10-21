// Local, generated sample cards (inline SVG) so the playground works before any upload.

const svg = (w: number, h: number, body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Inter, system-ui, -apple-system, sans-serif">${body}</svg>`,
  )}`

const mobileApp = svg(
  360,
  720,
  `<rect width="360" height="720" rx="36" fill="#0f1115"/>
  <rect x="24" y="28" width="60" height="8" rx="4" fill="#2a2f3a"/>
  <text x="24" y="92" fill="#f4f4f5" font-size="26" font-weight="700">Good morning</text>
  <text x="24" y="118" fill="#8b90a0" font-size="14">3 tasks due today</text>
  <rect x="24" y="146" width="312" height="168" rx="22" fill="url(#g1)"/>
  <text x="44" y="190" fill="#fff" font-size="13" opacity=".8">Focus streak</text>
  <text x="44" y="236" fill="#fff" font-size="44" font-weight="700">12 days</text>
  <rect x="44" y="266" width="200" height="8" rx="4" fill="#fff" opacity=".25"/>
  <rect x="44" y="266" width="140" height="8" rx="4" fill="#fff"/>
  ${[0, 1, 2]
    .map(
      (i) => `<rect x="24" y="${340 + i * 84}" width="312" height="70" rx="18" fill="#181b22"/>
  <circle cx="58" cy="${375 + i * 84}" r="14" fill="none" stroke="${['#7c9cff', '#5ee3b1', '#ffb86b'][i]}" stroke-width="3"/>
  <rect x="86" y="${362 + i * 84}" width="${[150, 190, 120][i]}" height="10" rx="5" fill="#e4e4e7"/>
  <rect x="86" y="${380 + i * 84}" width="${[90, 70, 110][i]}" height="8" rx="4" fill="#4b5161"/>`,
    )
    .join('')}
  <rect x="24" y="636" width="312" height="60" rx="30" fill="#181b22"/>
  ${[0, 1, 2, 3].map((i) => `<circle cx="${72 + i * 72}" cy="666" r="${i === 0 ? 7 : 5}" fill="${i === 0 ? '#7c9cff' : '#4b5161'}"/>`).join('')}
  <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d7bff"/><stop offset="1" stop-color="#b56bff"/></linearGradient></defs>`,
)

const dashboard = svg(
  640,
  420,
  `<rect width="640" height="420" rx="18" fill="#f7f7f8"/>
  <rect width="150" height="420" rx="18" fill="#111318"/><rect x="132" width="18" height="420" fill="#111318"/>
  <circle cx="34" cy="36" r="10" fill="#7c9cff"/>
  ${[0, 1, 2, 3, 4].map((i) => `<rect x="24" y="${80 + i * 34}" width="${[96, 80, 88, 70, 92][i]}" height="10" rx="5" fill="${i === 1 ? '#e4e4e7' : '#3a3f4b'}"/>`).join('')}
  <text x="176" y="50" fill="#111318" font-size="20" font-weight="700">Revenue</text>
  ${[0, 1, 2]
    .map(
      (i) => `<rect x="${176 + i * 150}" y="70" width="136" height="76" rx="12" fill="#fff" stroke="#e7e7ea"/>
  <text x="${190 + i * 150}" y="96" fill="#80838e" font-size="11">${['MRR', 'Active users', 'Churn'][i]}</text>
  <text x="${190 + i * 150}" y="128" fill="#111318" font-size="22" font-weight="700">${['$48.2k', '12,904', '1.8%'][i]}</text>`,
    )
    .join('')}
  <rect x="176" y="162" width="436" height="230" rx="12" fill="#fff" stroke="#e7e7ea"/>
  <polyline fill="none" stroke="#6d7bff" stroke-width="3" stroke-linejoin="round" points="196,350 240,330 284,338 328,300 372,306 416,262 460,276 504,230 548,238 592,196"/>
  <polyline fill="none" stroke="#c7cbd6" stroke-width="2" stroke-dasharray="4 5" points="196,360 240,352 284,350 328,336 372,334 416,318 460,316 504,300 548,296 592,280"/>`,
)

const palette = svg(
  480,
  300,
  `<rect width="480" height="300" rx="20" fill="#16181d"/>
  ${['#ff6b6b', '#ffb86b', '#f9e27d', '#5ee3b1', '#7c9cff', '#b56bff']
    .map((c, i) => `<rect x="${24 + i * 74}" y="24" width="62" height="170" rx="12" fill="${c}"/><text x="${28 + i * 74}" y="220" fill="#a1a5b3" font-size="11" font-family="ui-monospace, monospace">${c}</text>`)
    .join('')}
  <text x="24" y="270" fill="#f4f4f5" font-size="20" font-weight="700">Sunset palette</text>`,
)

const landscape = svg(
  560,
  380,
  `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2d6e"/><stop offset=".55" stop-color="#e0727b"/><stop offset="1" stop-color="#ffcf8a"/></linearGradient>
  </defs>
  <rect width="560" height="380" rx="16" fill="url(#sky)"/>
  <circle cx="380" cy="220" r="56" fill="#ffe6a8" opacity=".95"/>
  <path d="M0 270 L90 200 L170 250 L260 170 L360 260 L450 210 L560 260 L560 380 L0 380 Z" fill="#3b2a52"/>
  <path d="M0 310 L120 260 L230 300 L340 250 L460 300 L560 280 L560 380 L0 380 Z" fill="#241a36"/>`,
)

const typeCard = svg(
  420,
  420,
  `<rect width="420" height="420" rx="20" fill="#ece7dc"/>
  <text x="32" y="210" fill="#1a1a1a" font-size="168" font-weight="800" font-family="Georgia, serif">Aa</text>
  <text x="32" y="276" fill="#1a1a1a" font-size="22" font-weight="600">Display Serif</text>
  <text x="32" y="306" fill="#6b665c" font-size="14">The quick brown fox jumps over the lazy dog</text>
  <rect x="32" y="340" width="356" height="1" fill="#c9c2b3"/>
  <text x="32" y="372" fill="#6b665c" font-size="12" font-family="ui-monospace, monospace">72 / 56 / 40 / 28 / 18 / 14</text>`,
)

export interface SampleSpec {
  name: string
  src: string
  w: number
  h: number
}

export const SAMPLES: SampleSpec[] = [
  { name: 'Mobile app', src: mobileApp, w: 360, h: 720 },
  { name: 'Dashboard', src: dashboard, w: 640, h: 420 },
  { name: 'Palette', src: palette, w: 480, h: 300 },
  { name: 'Landscape', src: landscape, w: 560, h: 380 },
  { name: 'Type specimen', src: typeCard, w: 420, h: 420 },
]
