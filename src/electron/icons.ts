import { nativeImage, type NativeImage } from 'electron'

/** 16×16 silhouette of the pet, used for the tray. `#` = filled. */
const TRAY_GLYPH = [
  '................',
  '...##......##...',
  '..####....####..',
  '..############..',
  '.##############.',
  '.##############.',
  '################',
  '####..####..####',
  '####..####..####',
  '################',
  '################',
  '.##############.',
  '.##############.',
  '..############..',
  '...###....###...',
  '................'
]

/**
 * Build the tray icon at runtime from the pixel glyph (no image files needed).
 * macOS gets a template image so it adapts to light/dark menu bars.
 */
export function trayIcon(): NativeImage {
  const template = process.platform === 'darwin'
  const scale = 2
  const size = TRAY_GLYPH.length * scale
  const [r, g, b] = template ? [0, 0, 0] : [0x6f, 0xd3, 0xb0]
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (TRAY_GLYPH[Math.floor(y / scale)][Math.floor(x / scale)] !== '#') continue
      const i = (y * size + x) * 4
      buf[i] = b // BGRA
      buf[i + 1] = g
      buf[i + 2] = r
      buf[i + 3] = 255
    }
  }
  const image = nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: scale })
  if (template) image.setTemplateImage(true)
  return image
}
