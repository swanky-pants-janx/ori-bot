// Renders the app icon (build/icon.png, 1024×1024) from the creature sprite data.
// Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'
import { ori } from '../src/renderer/creature/ori.ts'

const SIZE = 1024
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const px = new Uint8ClampedArray(SIZE * SIZE * 4)

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

function blend(x, y, [r, g, b], a = 1) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a <= 0) return
  const i = (y * SIZE + x) * 4
  const inv = 1 - a
  px[i] = r * a + px[i] * inv
  px[i + 1] = g * a + px[i + 1] * inv
  px[i + 2] = b * a + px[i + 2] * inv
  px[i + 3] = Math.min(255, 255 * a + px[i + 3] * inv)
}

// Rounded-square background (macOS grid: 824px tile inside a 1024 canvas).
const tile = { x: 100, y: 100, size: 824, r: 185 }
const top = hex('#fff6e6')
const bottom = hex('#ffd6b0')
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = Math.max(tile.x + tile.r - x, 0, x - (tile.x + tile.size - tile.r))
    const dy = Math.max(tile.y + tile.r - y, 0, y - (tile.y + tile.size - tile.r))
    const d = Math.hypot(dx, dy) - tile.r
    const a = Math.min(1, Math.max(0, 0.5 - d))
    if (a <= 0) continue
    const t = (y - tile.y) / tile.size
    blend(x, y, top.map((c, i) => c + (bottom[i] - c) * t), a)
  }
}

// Soft ground shadow.
for (let y = 700; y < 800; y++) {
  for (let x = 250; x < 780; x++) {
    const e = ((x - 512) / 230) ** 2 + ((y - 752) / 26) ** 2
    if (e < 1) blend(x, y, [59, 45, 79], 0.18 * (1 - e))
  }
}

// The creature: happy face, blushing, with its sprout.
const layers = [
  { x: 0, y: 0, rows: ori.body },
  ori.stages.child,
  ...ori.cheeks,
  { ...ori.eyes.left, rows: ori.eyes.kinds.happy },
  { ...ori.eyes.right, rows: ori.eyes.kinds.happy, mirror: true },
  { x: ori.mouth.x, y: ori.mouth.y, rows: ori.mouth.kinds.cat }
]
const scale = 20
const ox = Math.round(SIZE / 2 - 15.5 * scale)
const oy = Math.round(SIZE / 2 - 15.5 * scale)
for (const layer of layers) {
  layer.rows.forEach((raw, ry) => {
    const row = layer.mirror ? [...raw].reverse().join('') : raw
    ;[...row].forEach((ch, rx) => {
      const color = ori.palette[ch]
      if (ch === '.' || !color) return
      const rgb = hex(color)
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) blend(ox + (layer.x + rx) * scale + x, oy + (layer.y + ry) * scale + y, rgb)
    })
  })
}

// Minimal PNG encoder.
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y++) Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1)
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])
const out = join(root, 'build', 'icon.png')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, png)
console.log(`wrote ${out} (${(png.length / 1024).toFixed(0)} KB)`)
