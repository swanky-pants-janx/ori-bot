/**
 * Simple 2D ball physics for thrown toys: gravity, bounces off the screen
 * edges, rolling friction on the floor. Pure functions, units are px and
 * seconds. The body's (x, y) is the top-left of the toy's window.
 */
import type { Point } from './motion'

export interface Body {
  x: number
  y: number
  vx: number
  vy: number
}

export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export const PHYSICS = {
  gravity: 2600,
  /** Energy kept when bouncing off the floor / walls. */
  floorBounce: 0.68,
  wallBounce: 0.8,
  /** Fraction of speed lost per second in the air. */
  airDrag: 0.12,
  /** Deceleration while rolling along the floor (px/s²). */
  rollFriction: 900,
  /** Below this the ball stops bouncing / rolling. */
  restSpeed: 30,
  maxThrow: 3600
} as const

export interface StepResult {
  body: Body
  bounced: boolean
  /** Sitting still on the floor. */
  resting: boolean
}

export function step(b: Body, dt: number, bounds: Bounds): StepResult {
  let { x, y, vx, vy } = b
  let bounced = false

  vy += PHYSICS.gravity * dt
  const drag = Math.max(0, 1 - PHYSICS.airDrag * dt)
  vx *= drag
  vy *= drag
  x += vx * dt
  y += vy * dt

  if (x < bounds.minX) {
    x = bounds.minX
    vx = Math.abs(vx) * PHYSICS.wallBounce
    bounced = true
  } else if (x > bounds.maxX) {
    x = bounds.maxX
    vx = -Math.abs(vx) * PHYSICS.wallBounce
    bounced = true
  }
  if (y < bounds.minY) {
    y = bounds.minY
    vy = Math.abs(vy) * PHYSICS.wallBounce
    bounced = true
  }

  let resting = false
  if (y >= bounds.maxY) {
    y = bounds.maxY
    if (vy > PHYSICS.restSpeed * 4) {
      vy = -vy * PHYSICS.floorBounce
      bounced = true
    } else {
      // Rolling along the floor.
      vy = 0
      const slow = PHYSICS.rollFriction * dt
      vx = Math.abs(vx) <= slow ? 0 : vx - Math.sign(vx) * slow
      resting = Math.abs(vx) < PHYSICS.restSpeed
      if (resting) vx = 0
    }
  }

  return { body: { x, y, vx, vy }, bounced, resting }
}

export interface Sample extends Point {
  t: number
}

/** Throw velocity from the last moments of a drag, capped to a sane maximum. */
export function releaseVelocity(samples: readonly Sample[], windowMs = 90): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 }
  const last = samples[samples.length - 1]
  const first = samples.find((s) => last.t - s.t <= windowMs) ?? samples[0]
  const dt = (last.t - first.t) / 1000
  if (dt <= 0) return { vx: 0, vy: 0 }
  let vx = (last.x - first.x) / dt
  let vy = (last.y - first.y) / dt
  const speed = Math.hypot(vx, vy)
  if (speed > PHYSICS.maxThrow) {
    vx = (vx / speed) * PHYSICS.maxThrow
    vy = (vy / speed) * PHYSICS.maxThrow
  }
  return { vx, vy }
}

/**
 * Close enough for the pet to catch the ball. Tall rather than wide: the pet's
 * sprite reaches down to the floor even when its centre can't.
 */
export function withinReach(petCenter: Point, ballCenter: Point): boolean {
  const dx = (ballCenter.x - petCenter.x) / 60
  const dy = (ballCenter.y - petCenter.y) / 100
  return dx * dx + dy * dy <= 1
}
