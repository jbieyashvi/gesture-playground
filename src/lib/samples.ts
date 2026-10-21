// Default gallery: photos shipped in `public/gallery/`, shown on every fresh visit before any upload.
// BASE_URL keeps the paths working both locally (`/`) and on GitHub Pages (`/gesture-playground/`).

export interface SampleSpec {
  name: string
  src: string
  w: number
  h: number
}

const photo = (file: string) => `${import.meta.env.BASE_URL}gallery/${file}`

export const SAMPLES: SampleSpec[] = [
  { name: 'IMG_0158', src: photo('img-0158.jpg'), w: 1800, h: 2400 },
  { name: 'IMG_8180', src: photo('img-8180.jpg'), w: 1800, h: 2400 },
  { name: 'IMG_5453', src: photo('img-5453.jpg'), w: 736, h: 1051 },
  { name: 'IMG_8235', src: photo('img-8235.jpg'), w: 1170, h: 1543 },
  { name: 'Anders Jildén · Unsplash', src: photo('anders-jilden-unsplash.jpg'), w: 3000, h: 2000 },
]
