import type { PixelLayer } from './types'

export interface PixelRun {
  x: number
  y: number
  w: number
  fill: string
}

/** Convert pixel layers into horizontal runs (one <rect> per run keeps the SVG small). */
export function toRuns(layers: readonly PixelLayer[], palette: Readonly<Record<string, string>>): PixelRun[] {
  const runs: PixelRun[] = []
  for (const layer of layers) {
    layer.rows.forEach((raw, dy) => {
      const row = layer.mirror ? [...raw].reverse().join('') : raw
      let x = 0
      while (x < row.length) {
        const ch = row[x]
        let end = x + 1
        while (end < row.length && row[end] === ch) end++
        const fill = palette[ch]
        if (ch !== '.' && fill) runs.push({ x: layer.x + x, y: layer.y + dy, w: end - x, fill })
        x = end
      }
    })
  }
  return runs
}
