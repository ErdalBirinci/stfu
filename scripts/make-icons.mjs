import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

// One source of truth for the app icon: the STFU mark — a broken circle with a
// dot, on the same blue gradient the logo uses in the app.
const mark = (size, { rounded = true, inset = 1 } = {}) => {
  const pad = (1 - inset) * (size / 2)
  const scale = inset
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5aa2ff"/>
      <stop offset="1" stop-color="#0a5bd6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.226 : 0}" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})">
    <circle cx="${size / 2}" cy="${size * 0.53}" r="${size * 0.255}" fill="none" stroke="#ffffff"
      stroke-width="${size * 0.058}" stroke-linecap="round" stroke-dasharray="${size * 1.19} ${size * 0.63}"/>
    <circle cx="${size / 2}" cy="${size * 0.225}" r="${size * 0.082}" fill="#ffffff"/>
  </g>
</svg>`
}

const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <circle cx="48" cy="52" r="27" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"
    stroke-dasharray="118 62"/>
  <circle cx="48" cy="20" r="8" fill="#ffffff"/>
</svg>`

await mkdir('public/icons', { recursive: true })

const jobs = [
  ['public/icons/icon-192.png', mark(192), 192],
  ['public/icons/icon-512.png', mark(512), 512],
  ['public/icons/icon-maskable-512.png', mark(512, { rounded: false, inset: 0.72 }), 512],
  ['public/icons/apple-touch-icon.png', mark(180, { rounded: false, inset: 0.86 }), 180],
]

for (const [file, svg, size] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file)
  console.log('wrote', file)
}

await sharp(Buffer.from(badge)).png({ compressionLevel: 9 }).toFile('public/icons/badge-96.png')
console.log('wrote public/icons/badge-96.png')
