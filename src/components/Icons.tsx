import type { ReactNode } from 'react'

const Svg = ({ children }: { children: ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const CameraIcon = () => (
  <Svg>
    <path d="M15 10l5-3v10l-5-3z" />
    <rect x="3" y="6" width="12" height="12" rx="2.5" />
  </Svg>
)
export const StopIcon = () => (
  <Svg>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Svg>
)
export const UploadIcon = () => (
  <Svg>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </Svg>
)
export const GridIcon = () => (
  <Svg>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Svg>
)
export const HandIcon = () => (
  <Svg>
    <path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-6.5a1.5 1.5 0 013 0V11m0-5a1.5 1.5 0 013 0v7.5a6.5 6.5 0 01-6.5 6.5h-.6a6 6 0 01-4.6-2.2L4.4 14.5a1.5 1.5 0 012.3-1.9L8 14" />
  </Svg>
)
export const HelpIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" />
  </Svg>
)
export const PresentIcon = () => (
  <Svg>
    <path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4" />
  </Svg>
)
export const HideIcon = () => (
  <Svg>
    <path d="M6 15l6-6 6 6" />
  </Svg>
)
export const ShowIcon = () => (
  <Svg>
    <path d="M6 9l6 6 6-6" />
  </Svg>
)
export const CloseIcon = () => (
  <Svg>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)
