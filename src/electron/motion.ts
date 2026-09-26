/**
 * Pure helpers for moving the pet around the desktop. No Electron imports,
 * so the maths can be unit-tested; `roamer.ts` and `window.ts` drive it.
 */
import type { Mood, Personality } from '../types/pet'
import { LAYOUT } from '../types/layout'
import type { Rng } from '../utils/math'

export interface Point {
  x: number
  y: number
}

export interface Rect extends Point {
  width: number
  height: number
}

const { width: WIDTH, compactHeight: COMPACT, petCenterFromBottom } = LAYOUT
/** How much of the transparent margin may hang off the screen edge. */
const SLACK_X = WIDTH / 2 - 70
const SLACK_TOP = 70

/** Offset from the window's top-left to the pet's centre (compact layout). */
export const PET_OFFSET: Point = { x: WIDTH / 2, y: COMPACT - petCenterFromBottom }

/** Where the compact window's top-left may go so the pet stays fully on screen. */
export function anchorBounds(area: Rect): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: area.x - SLACK_X,
    maxX: area.x + area.width - WIDTH + SLACK_X,
    minY: area.y - SLACK_TOP,
    maxY: area.y + area.height - COMPACT
  }
}

export function clampAnchor(p: Point, area: Rect): Point {
  const b = anchorBounds(area)
  return { x: Math.min(Math.max(p.x, b.minX), b.maxX), y: Math.min(Math.max(p.y, b.minY), b.maxY) }
}

export const easeInOut = (t: number): number => 0.5 - Math.cos(Math.PI * t) / 2

// ---- Deciding when to fly

export type Behaviour = 'stay' | 'wander' | 'follow'

export interface BehaviourInputs {
  mood: Mood
  /** Doing something (eating, being asked for something, …) – don't wander off. */
  busy: boolean
  personality: Personality
  followEnabled: boolean
}

/** Chance per second of taking off, by mood. Moods not listed never fly. */
const WANDER_PER_SECOND: Partial<Record<Mood, number>> = {
  excited: 1 / 20,
  happy: 1 / 55,
  idle: 1 / 80,
  hungry: 1 / 120,
  angry: 1 / 60,
  sad: 1 / 240,
  sleepy: 1 / 300
}

/** Rolled once per second while the pet is sitting still. */
export function planBehaviour(i: BehaviourInputs, rng: Rng): Behaviour {
  const wander = WANDER_PER_SECOND[i.mood]
  if (!wander || i.busy) return 'stay'

  // Cuddly, playful pets tag along after the cursor more often.
  let follow = 0
  if (i.followEnabled && i.mood !== 'angry') {
    const fondness = (0.4 + i.personality.affection / 100) * (0.4 + i.personality.playfulness / 100)
    const moodFactor = i.mood === 'excited' ? 2 : i.mood === 'sad' || i.mood === 'sleepy' ? 0.3 : 1
    follow = (fondness * moodFactor) / 150
  }

  const roll = rng()
  if (roll < follow) return 'follow'
  if (roll < follow + wander) return 'wander'
  return 'stay'
}

// ---- Where to fly

/** A random spot on the same screen, not too close and not too far. */
export function wanderTarget(area: Rect, from: Point, rng: Rng): Point {
  const b = anchorBounds(area)
  let best: Point = from
  for (let i = 0; i < 12; i++) {
    const p = { x: b.minX + rng() * (b.maxX - b.minX), y: b.minY + rng() * (b.maxY - b.minY) }
    const d = Math.hypot(p.x - from.x, p.y - from.y)
    best = p
    if (d >= 160 && d <= 750) break
  }
  return { x: Math.round(best.x), y: Math.round(best.y) }
}

/** Keep this far beside the cursor so the pet never sits under it and blocks clicks. */
const FOLLOW_GAP = 150

/**
 * Where the window should be to hover beside the cursor. Stays on its current
 * side unless that would push it off the screen.
 */
export function followTarget(cursor: Point, side: 1 | -1, area: Rect): { anchor: Point; side: 1 | -1 } {
  const place = (s: 1 | -1): Point => ({
    x: cursor.x + s * FOLLOW_GAP - PET_OFFSET.x,
    y: cursor.y + 10 - PET_OFFSET.y
  })
  let anchor = place(side)
  const clamped = clampAnchor(anchor, area)
  if (Math.abs(clamped.x - anchor.x) > FOLLOW_GAP / 2) {
    side = side === 1 ? -1 : 1
    anchor = place(side)
  }
  return { anchor: clampAnchor(anchor, area), side }
}

// ---- Standing on other windows

/** A window as far as perching is concerned (front-most first in any list). */
export interface Ledge extends Rect {
  id: number
}

const FEET = LAYOUT.petFeetFromTop
/** Keep this far in from a window's ends so the pet doesn't dangle off. */
const LEDGE_MARGIN = 34
/** A window's top edge needs this much room above it for the pet to fit. */
const HEADROOM = 150

/** Window top-left for the pet standing on `ledge` with its centre `offsetX` from the ledge's left end. */
export function perchAnchor(ledge: Rect, offsetX: number): Point {
  return { x: ledge.x + offsetX - PET_OFFSET.x, y: ledge.y - FEET + 2 }
}

/** Is the point just above a ledge hidden under a window that's in front of it? */
export function isCovered(ledges: readonly Ledge[], index: number, x: number): boolean {
  const y = ledges[index].y + 1
  for (let i = 0; i < index; i++) {
    const w = ledges[i]
    if (x >= w.x && x <= w.x + w.width && y >= w.y && y <= w.y + w.height) return true
  }
  return false
}

/** Can the pet stand on this ledge at all (on screen, wide enough, room above)? */
export function isUsable(ledge: Rect, area: Rect): boolean {
  return (
    ledge.width >= LEDGE_MARGIN * 2 + 40 &&
    ledge.y >= area.y + HEADROOM &&
    ledge.y <= area.y + area.height - 20 &&
    ledge.x + ledge.width > area.x + LEDGE_MARGIN &&
    ledge.x < area.x + area.width - LEDGE_MARGIN
  )
}

/** Clamp a stance to the part of the ledge that's actually on screen. */
export function clampOffset(ledge: Rect, offsetX: number, area: Rect): number {
  const left = Math.max(ledge.x, area.x) - ledge.x + LEDGE_MARGIN
  const right = Math.min(ledge.x + ledge.width, area.x + area.width) - ledge.x - LEDGE_MARGIN
  return Math.min(Math.max(offsetX, left), Math.max(left, right))
}

/** The stretches of a ledge's top edge (as offsets from its left end) not hidden by windows in front. */
export function uncoveredSpans(ledges: readonly Ledge[], index: number, area: Rect): [number, number][] {
  const l = ledges[index]
  let spans: [number, number][] = [[clampOffset(l, -Infinity, area), clampOffset(l, Infinity, area)]]
  const y = l.y + 1
  for (let i = 0; i < index; i++) {
    const w = ledges[i]
    if (y < w.y || y > w.y + w.height) continue
    const from = w.x - l.x - LEDGE_MARGIN
    const to = w.x + w.width - l.x + LEDGE_MARGIN
    spans = spans.flatMap(([a, b]): [number, number][] => {
      if (to <= a || from >= b) return [[a, b]]
      const parts: [number, number][] = []
      if (from > a) parts.push([a, from])
      if (to < b) parts.push([to, b])
      return parts
    })
  }
  return spans.filter(([a, b]) => b - a >= 1)
}

/**
 * Pick a random uncovered spot on some window to fly to, or null if there's
 * nowhere good. `areaOf` gives each window's screen (windows can be on any display).
 */
export function pickPerch(
  ledges: readonly Ledge[],
  areaOf: (ledge: Ledge) => Rect,
  rng: Rng
): { id: number; offsetX: number } | null {
  const options = ledges.flatMap((l, i) => {
    const area = areaOf(l)
    return isUsable(l, area) ? uncoveredSpans(ledges, i, area).map(([a, b]) => ({ id: l.id, a, b })) : []
  })
  const total = options.reduce((sum, o) => sum + (o.b - o.a), 0)
  if (total <= 0) return null
  let pickAt = rng() * total
  for (const o of options) {
    const len = o.b - o.a
    if (pickAt <= len) return { id: o.id, offsetX: o.a + pickAt }
    pickAt -= len
  }
  const last = options[options.length - 1]
  return { id: last.id, offsetX: last.b }
}

/**
 * The ledge the pet's feet land on when moving down from `fromY` to `toY`
 * at screen x `x` – the front-most uncovered one crossed, if any.
 */
export function ledgeCrossed(ledges: readonly Ledge[], x: number, fromY: number, toY: number, area: Rect): Ledge | null {
  let best: Ledge | null = null
  ledges.forEach((l, i) => {
    if (!isUsable(l, area)) return
    if (x < l.x + LEDGE_MARGIN || x > l.x + l.width - LEDGE_MARGIN) return
    if (!(fromY <= l.y && toY >= l.y)) return
    if (isCovered(ledges, i, x)) return
    if (!best || l.y < best.y) best = l
  })
  return best
}

/** Screen position of the pet's feet for a given window top-left. */
export function feetOf(anchor: Point): Point {
  return { x: anchor.x + PET_OFFSET.x, y: anchor.y + FEET }
}

// ---- Shake detection while dragging

/**
 * Detects a back-and-forth shake from a stream of cursor samples: several
 * quick direction reversals within a short window.
 */
export class ShakeDetector {
  private last: Point | null = null
  private dirX = 0
  private dirY = 0
  private reversals: number[] = []
  private lastFired = -Infinity

  constructor(
    private readonly opts = {
      /** Minimum movement per sample to count as a deliberate direction (px). */
      minStep: 6,
      /** Reversals must happen within this window (ms). */
      windowMs: 900,
      reversals: 4,
      /** Don't report again until this much time has passed (ms). */
      cooldownMs: 1200
    }
  ) {}

  /** Feed a cursor sample. Returns true when a shake is detected. */
  sample(p: Point, now: number): boolean {
    if (this.last) {
      this.track(p.x - this.last.x, 'x', now)
      this.track(p.y - this.last.y, 'y', now)
    }
    this.last = p
    this.reversals = this.reversals.filter((t) => now - t <= this.opts.windowMs)
    if (this.reversals.length >= this.opts.reversals && now - this.lastFired >= this.opts.cooldownMs) {
      this.lastFired = now
      this.reversals = []
      return true
    }
    return false
  }

  reset(): void {
    this.last = null
    this.dirX = 0
    this.dirY = 0
    this.reversals = []
  }

  private track(delta: number, axis: 'x' | 'y', now: number): void {
    if (Math.abs(delta) < this.opts.minStep) return
    const dir = Math.sign(delta)
    const prev = axis === 'x' ? this.dirX : this.dirY
    if (prev !== 0 && dir !== prev) this.reversals.push(now)
    if (axis === 'x') this.dirX = dir
    else this.dirY = dir
  }
}
