import { describe, expect, it } from 'vitest'
import { CREATURE_IDS } from '../../types/settings'
import { CREATURES } from './index'
import { EYE_KINDS, MOUTH_KINDS, type CreatureArt, type PixelLayer } from './types'

function checkLayer(art: CreatureArt, layer: PixelLayer, name: string): void {
  const width = layer.rows[0].length
  for (const row of layer.rows) {
    expect(row.length, `${art.name} ${name}: ragged row`).toBe(width)
    for (const ch of row) if (ch !== '.') expect(art.palette, `${art.name} ${name}: unknown colour "${ch}"`).toHaveProperty(ch)
  }
  expect(layer.x, `${art.name} ${name}: off the left edge`).toBeGreaterThanOrEqual(0)
  expect(layer.x + width, `${art.name} ${name}: overflows right edge`).toBeLessThanOrEqual(art.width)
  expect(layer.y + layer.rows.length, `${art.name} ${name}: overflows bottom`).toBeLessThanOrEqual(art.height)
}

describe.each(CREATURE_IDS.map((id) => [id, CREATURES[id]] as const))('creature art: %s', (_id, art) => {
  it('has a well-formed body grid', () => {
    expect(art.body).toHaveLength(art.height)
    checkLayer(art, { x: 0, y: 0, rows: art.body }, 'body')
    for (const layer of art.back ?? []) checkLayer(art, layer, 'back')
  })

  it('mirrors the eyes and centres the mouth', () => {
    const eyeWidth = art.eyes.kinds.open[0].length
    expect(art.eyes.right.x).toBe(art.width - art.eyes.left.x - eyeWidth)
    expect(art.eyes.right.y).toBe(art.eyes.left.y)
    const mouthWidth = art.mouth.kinds.smile[0].length
    expect(art.mouth.x * 2 + mouthWidth).toBe(art.width)
  })

  it('defines every expression and accessory within bounds', () => {
    const eyeWidth = art.eyes.kinds.open[0].length
    for (const kind of EYE_KINDS) {
      expect(art.eyes.kinds[kind][0].length, `eyes.${kind} width`).toBe(eyeWidth)
      checkLayer(art, { ...art.eyes.left, rows: art.eyes.kinds[kind] }, `eyes.${kind}`)
      checkLayer(art, { ...art.eyes.right, rows: art.eyes.kinds[kind] }, `eyes.${kind} (right)`)
    }
    for (const kind of MOUTH_KINDS) {
      checkLayer(art, { x: art.mouth.x, y: art.mouth.y, rows: art.mouth.kinds[kind] }, `mouth.${kind}`)
    }
    for (const [stage, layer] of Object.entries(art.stages)) if (layer) checkLayer(art, layer, `stage.${stage}`)
    art.cheeks.forEach((c, i) => checkLayer(art, c, `cheek ${i}`))
    art.dirt.flat().forEach((d, i) => checkLayer(art, d, `dirt ${i}`))
  })
})
