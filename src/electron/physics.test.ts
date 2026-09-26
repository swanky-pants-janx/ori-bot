import { describe, expect, it } from 'vitest'
import { releaseVelocity, step, withinReach, type Body, type Bounds } from './physics'

const bounds: Bounds = { minX: 0, maxX: 1392, minY: 25, maxY: 827 }

function simulate(body: Body, seconds: number): { body: Body; bounces: number; restedAt: number | null } {
  let b = body
  let bounces = 0
  let restedAt: number | null = null
  for (let t = 0; t < seconds; t += 1 / 60) {
    const r = step(b, 1 / 60, bounds)
    b = r.body
    if (r.bounced) bounces++
    if (r.resting && restedAt === null) restedAt = t
  }
  return { body: b, bounces, restedAt }
}

describe('ball physics', () => {
  it('falls, bounces a few times, then rolls to a stop on the floor', () => {
    const { body, bounces, restedAt } = simulate({ x: 600, y: 100, vx: 400, vy: 0 }, 10)
    expect(body.y).toBe(bounds.maxY)
    expect(body.vx).toBe(0)
    expect(bounces).toBeGreaterThanOrEqual(3)
    expect(restedAt).not.toBeNull()
  })

  it('never leaves the screen, even when thrown hard', () => {
    let b: Body = { x: 700, y: 400, vx: -3600, vy: -3000 }
    for (let i = 0; i < 600; i++) {
      b = step(b, 1 / 60, bounds).body
      expect(b.x).toBeGreaterThanOrEqual(bounds.minX)
      expect(b.x).toBeLessThanOrEqual(bounds.maxX)
      expect(b.y).toBeGreaterThanOrEqual(bounds.minY)
      expect(b.y).toBeLessThanOrEqual(bounds.maxY)
    }
  })

  it('bounces off walls back into the screen', () => {
    const r = step({ x: 5, y: 400, vx: -1000, vy: 0 }, 1 / 60, bounds)
    expect(r.bounced).toBe(true)
    expect(r.body.vx).toBeGreaterThan(0)
  })
})

describe('throwing', () => {
  it('takes the velocity from the end of the drag', () => {
    const samples = [
      { x: 0, y: 0, t: 0 },
      { x: 10, y: 0, t: 100 },
      { x: 60, y: -20, t: 150 },
      { x: 110, y: -40, t: 200 }
    ]
    const v = releaseVelocity(samples)
    expect(v.vx).toBeCloseTo(1000, -1)
    expect(v.vy).toBeCloseTo(-400, -1)
  })

  it('caps absurd flicks and treats a still release as a drop', () => {
    const v = releaseVelocity([
      { x: 0, y: 0, t: 0 },
      { x: 2000, y: 0, t: 10 }
    ])
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(3600, 0)
    expect(releaseVelocity([{ x: 5, y: 5, t: 0 }])).toEqual({ vx: 0, vy: 0 })
  })

  it('lets the pet reach a ball on the floor by its feet', () => {
    expect(withinReach({ x: 500, y: 700 }, { x: 520, y: 785 })).toBe(true)
    expect(withinReach({ x: 500, y: 700 }, { x: 640, y: 700 })).toBe(false)
  })
})
