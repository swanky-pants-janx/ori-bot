import { describe, expect, it } from 'vitest'
import type { Personality } from '../types/pet'
import { anchorBounds, followTarget, planBehaviour, ShakeDetector, wanderTarget, type Rect } from './motion'

const screen: Rect = { x: 0, y: 25, width: 1440, height: 850 }
const traits: Personality = { friendliness: 50, playfulness: 50, curiosity: 50, stubbornness: 50, affection: 50, energy: 50 }

describe('ShakeDetector', () => {
  it('detects a back-and-forth shake', () => {
    const d = new ShakeDetector()
    let fired = false
    for (let i = 0; i < 20; i++) {
      const x = i % 2 === 0 ? 100 : 160
      fired = d.sample({ x, y: 300 }, i * 50) || fired
    }
    expect(fired).toBe(true)
  })

  it('ignores an ordinary drag across the screen', () => {
    const d = new ShakeDetector()
    let fired = false
    for (let i = 0; i < 60; i++) fired = d.sample({ x: 100 + i * 12, y: 300 + i * 3 }, i * 16) || fired
    expect(fired).toBe(false)
  })

  it('ignores tiny jitter', () => {
    const d = new ShakeDetector()
    let fired = false
    for (let i = 0; i < 40; i++) fired = d.sample({ x: 100 + (i % 2) * 3, y: 300 }, i * 16) || fired
    expect(fired).toBe(false)
  })
})

describe('planBehaviour', () => {
  const always = () => 0
  it('never flies while asleep, eating, sick, dizzy or busy', () => {
    for (const mood of ['sleeping', 'eating', 'playing', 'sick', 'dizzy'] as const) {
      expect(planBehaviour({ mood, busy: false, personality: traits, followEnabled: true }, always)).toBe('stay')
    }
    expect(planBehaviour({ mood: 'happy', busy: true, personality: traits, followEnabled: true }, always)).toBe('stay')
  })

  it('only follows the cursor when allowed', () => {
    const inputs = { mood: 'happy' as const, busy: false, personality: traits }
    expect(planBehaviour({ ...inputs, followEnabled: true }, always)).toBe('follow')
    expect(planBehaviour({ ...inputs, followEnabled: false }, always)).toBe('wander')
    expect(planBehaviour({ ...inputs, followEnabled: true }, () => 0.99)).toBe('stay')
  })
})

describe('targets', () => {
  it('wanders somewhere on the same screen', () => {
    const b = anchorBounds(screen)
    let seed = 1
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 50; i++) {
      const t = wanderTarget(screen, { x: 600, y: 400 }, rng)
      expect(t.x).toBeGreaterThanOrEqual(b.minX)
      expect(t.x).toBeLessThanOrEqual(b.maxX)
      expect(t.y).toBeGreaterThanOrEqual(b.minY)
      expect(t.y).toBeLessThanOrEqual(b.maxY)
    }
  })

  it('hovers beside the cursor and switches sides at the screen edge', () => {
    expect(followTarget({ x: 700, y: 400 }, 1, screen).side).toBe(1)
    expect(followTarget({ x: 1420, y: 400 }, 1, screen).side).toBe(-1)
    expect(followTarget({ x: 10, y: 400 }, -1, screen).side).toBe(1)
  })
})

describe('perching on windows', async () => {
  const { clampOffset, feetOf, isCovered, ledgeCrossed, perchAnchor, pickPerch } = await import('./motion')
  const area: Rect = { x: 0, y: 25, width: 1440, height: 850 }
  // Front-most first: a small window overlapping the left part of a big one.
  const front = { id: 1, x: 100, y: 300, width: 400, height: 300 }
  const back = { id: 2, x: 50, y: 200, width: 900, height: 600 }
  const ledges = [front, back]

  it('stands with its feet on the top edge', () => {
    const a = perchAnchor(back, 300)
    const feet = feetOf(a)
    expect(feet.x).toBe(back.x + 300)
    expect(Math.abs(feet.y - back.y)).toBeLessThanOrEqual(2)
  })

  it('knows when a spot on a ledge is hidden behind a window in front', () => {
    expect(isCovered(ledges, 1, 700)).toBe(false) // right part of the back window's top edge
    expect(isCovered(ledges, 0, 200)).toBe(false) // front window is never covered
    const overlapping = [{ id: 3, x: 0, y: 150, width: 600, height: 200 }, back]
    expect(isCovered(overlapping, 1, 300)).toBe(true)
  })

  it('only picks uncovered, on-screen spots with room above', () => {
    let seed = 3
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const tooHigh = { id: 9, x: 0, y: 30, width: 800, height: 400 } // maximised, at the back: no headroom
    for (let i = 0; i < 30; i++) {
      const p = pickPerch([...ledges, tooHigh], () => area, rng)
      expect(p).not.toBeNull()
      expect(p!.id).not.toBe(9)
    }
    expect(pickPerch([tooHigh], () => area, rng)).toBeNull()
  })

  it('finds the sliver of a ledge peeking out from behind a front window', async () => {
    const { uncoveredSpans } = await import('./motion')
    const cover = { id: 5, x: 0, y: 100, width: 800, height: 500 }
    const behind = { id: 6, x: 50, y: 200, width: 900, height: 600 }
    const spans = uncoveredSpans([cover, behind], 1, area)
    expect(spans).toHaveLength(1)
    expect(behind.x + spans[0][0]).toBeGreaterThanOrEqual(800 + 34)
    let seed = 1
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    // The front window is too high up to stand on, so the sliver behind it is the only spot.
    for (let i = 0; i < 20; i++) {
      const p = pickPerch([cover, behind], () => area, rng)
      expect(p?.id).toBe(6)
      expect(behind.x + p!.offsetX).toBeGreaterThanOrEqual(800 + 34)
    }
  })

  it('lands on the first ledge its feet cross while falling', () => {
    expect(ledgeCrossed(ledges, 700, 150, 260, area)?.id).toBe(2)
    expect(ledgeCrossed(ledges, 300, 250, 320, area)?.id).toBe(1)
    expect(ledgeCrossed(ledges, 1200, 150, 900, area)).toBeNull() // nothing under it
  })

  it('can pick windows on another display', () => {
    const second: Rect = { x: 1440, y: -150, width: 2560, height: 1050 }
    const there = { id: 7, x: 3300, y: 300, width: 620, height: 380 }
    const areaOf = (l: Rect) => (l.x >= 1440 ? second : area)
    expect(pickPerch([there], areaOf, () => 0.5)?.id).toBe(7)
    expect(pickPerch([there], () => area, () => 0.5)).toBeNull()
  })

  it('keeps the stance on the visible part of a window hanging off screen', () => {
    const offRight = { x: 1300, y: 300, width: 600, height: 300 }
    expect(clampOffset(offRight, 500, area)).toBeLessThanOrEqual(1440 - 1300 - 34)
  })
})
