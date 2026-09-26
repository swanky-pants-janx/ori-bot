import { screen } from 'electron'
import type { PetService } from '../services/petService'
import type { SettingsService } from '../services/settingsService'
import { IPC, type AppCategory, type FlightMode, type MotionInfo } from '../types/api'
import { DesktopWatcher } from './desktop/watcher'
import {
  anchorBounds,
  clampAnchor,
  clampOffset,
  easeInOut,
  feetOf,
  followTarget,
  isCovered,
  isUsable,
  ledgeCrossed,
  PET_OFFSET,
  perchAnchor,
  pickPerch,
  planBehaviour,
  uncoveredSpans,
  wanderTarget,
  type Ledge,
  type Point
} from './motion'
import { withinReach } from './physics'
import type { PetWindow } from './window'

const FRAME_MS = 16
const THINK_MS = 1000
const WANDER_SPEED = 170 // px/s
const WALK_SPEED = 42 // px/s
const FALL_GRAVITY = 2200 // px/s²
const MAX_FALL_SPEED = 1600
/** Stay put for a while after launch, after landing, and after the user touches the pet. */
const QUIET_AFTER_START_MS = 20_000
const QUIET_AFTER_LANDING_MS = 8_000
const QUIET_AFTER_INTERACTION_MS = 12_000
/** A forced take-off ignores the cursor brushing past for this long. */
const FORCED_GRACE_MS = 1500
/** Dropped by the user this close to a window's top edge: sit on it. */
const DROP_SNAP_PX = 45
/** While perched, per-second chances to stroll along the window or to leave it. */
const WALK_CHANCE = 1 / 10
const LEAVE_CHANCE = 1 / 90
/** Apps where the user is concentrating: wander off less. */
const FOCUS_APPS: readonly AppCategory[] = ['code', 'write', 'design']

type Mode = 'idle' | 'wander' | 'follow' | 'chase' | 'toPerch' | 'walk' | 'fall'
type Say = 'wander' | 'follow' | 'chase' | 'perch' | 'fall' | 'land'

/**
 * Moves the pet around the desktop on its own: flying about, following the
 * cursor, chasing the ball, and sitting and walking on top of other windows
 * (riding along when they move, falling off when they go away). Mood and
 * personality decide how often; the user always wins – hovering, dragging or
 * opening a panel stops it.
 */
export class Roamer {
  private mode: Mode = 'idle'
  /** Standing on another window: which one, and where along its top edge. */
  private perch: { id: number; offsetX: number } | null = null
  private frameTimer: ReturnType<typeof setInterval> | null = null
  private thinkTimer: ReturnType<typeof setInterval> | null = null
  private step: ((dt: number) => void) | null = null
  private lastFrame = 0
  private pos: Point = { x: 0, y: 0 }
  private quietUntil = 0
  private ignoreHoverUntil = 0
  private motion: MotionInfo = { state: 'still', dir: 0 }
  private activity: AppCategory | null = null
  private readonly holds = new Set<string>()
  private readonly rng = Math.random

  constructor(
    private readonly win: PetWindow,
    private readonly pets: PetService,
    private readonly settings: SettingsService,
    private readonly desktop: DesktopWatcher
  ) {
    win.onInteract = (kind) => {
      if (kind === 'hover' && Date.now() < this.ignoreHoverUntil) return
      this.interrupt(kind)
    }
    win.onDragEnd = () => this.dropped()
    settings.onChange((s) => {
      if (!s.roam && this.mode !== 'fall') this.stopMoving()
      if (!s.perchOnWindows && this.perch) this.leavePerch()
      this.updateWatchRate()
    })
  }

  start(): void {
    if (this.thinkTimer) return
    this.quietUntil = Date.now() + QUIET_AFTER_START_MS
    this.thinkTimer = setInterval(() => this.think(), THINK_MS)
    this.updateWatchRate()
  }

  stop(): void {
    if (this.thinkTimer) clearInterval(this.thinkTimer)
    this.thinkTimer = null
    this.stopMoving()
    this.perch = null
    this.stopFrames()
    this.desktop.want('roamer', 'off')
  }

  /** Pause (or resume) autonomous flights. Chasing a toy is still allowed. */
  setHold(reason: string, on: boolean): void {
    if (on) {
      this.holds.add(reason)
      if (this.mode === 'wander' || this.mode === 'follow' || this.mode === 'toPerch' || this.mode === 'walk') {
        this.stopMoving()
      }
    } else {
      this.holds.delete(reason)
    }
  }

  /** App awareness: calls mean stay put; focused work means wander less. */
  setActivity(category: AppCategory | null): void {
    this.activity = category
    this.setHold('call', category === 'call')
  }

  /** Take off right now (the Fly cheats), regardless of mood or cool-downs. */
  fly(mode: FlightMode): void {
    if (this.mode === 'fall') return
    this.stopMoving()
    if (!this.win.canFly()) return
    this.ignoreHoverUntil = Date.now() + FORCED_GRACE_MS
    if (mode === 'follow') this.follow(12_000)
    else if (mode === 'perch') {
      if (!this.flyToPerch()) this.pets.roamRemark('land')
    } else this.wander()
  }

  /**
   * Fly after a moving target (a thrown ball) until within reach, then call
   * `onReach`. Gives up if the target disappears or after `timeoutMs`.
   */
  chase(target: () => Point | null, onReach: () => void, timeoutMs = 10_000): void {
    this.stopMoving()
    if (!this.win.canFly()) return
    const until = Date.now() + timeoutMs
    // The user's cursor is usually right there after a throw – don't let it stop the chase.
    this.ignoreHoverUntil = until
    this.takeOff('chase', 0)
    this.step = () => {
      const t = target()
      if (!t || Date.now() > until) return this.endFlight()
      if (withinReach({ x: this.pos.x + PET_OFFSET.x, y: this.pos.y + PET_OFFSET.y }, t)) {
        this.endFlight()
        onReach()
        return
      }
      const area = screen.getDisplayNearestPoint(t).workArea
      this.steerTo(clampAnchor({ x: t.x - PET_OFFSET.x, y: t.y - PET_OFFSET.y }, area), 0.12, 14)
    }
  }

  /** Stop chasing (e.g. the user grabbed the ball again). */
  stopChase(): void {
    if (this.mode === 'chase') this.endFlight()
  }

  // ---- Deciding what to do

  private think(): void {
    if (Date.now() < this.quietUntil || this.holds.size > 0) return
    const s = this.settings.get()
    if (!s.roam || !this.win.canRoam()) return
    // Let the user concentrate.
    if (this.activity && FOCUS_APPS.includes(this.activity) && this.rng() < 0.6) return
    const snap = this.pets.snapshot()

    if (this.mode === 'idle' && this.perch) {
      if (snap.state.sleeping || snap.activity || snap.mood === 'sick') return
      const roll = this.rng()
      if (roll < LEAVE_CHANCE) {
        this.leavePerch()
        if (!(this.rng() < 0.5 && s.perchOnWindows && this.flyToPerch())) this.wander()
      } else if (roll < LEAVE_CHANCE + WALK_CHANCE) {
        this.startWalk()
      }
      return
    }

    if (this.mode !== 'idle') return
    const plan = planBehaviour(
      {
        mood: snap.mood,
        busy: snap.activity !== null || snap.request !== null,
        personality: snap.personality,
        followEnabled: s.followCursor
      },
      this.rng
    )
    if (plan === 'follow') this.follow(6000 + this.rng() * 8000)
    else if (plan === 'wander') {
      // Half the time, go and sit on a window instead of just flying about.
      if (!(s.perchOnWindows && this.rng() < 0.5 && this.flyToPerch())) this.wander()
    }
  }

  // ---- Flights

  private wander(): void {
    const from = this.win.anchor()
    const to = wanderTarget(this.win.workArea(), from, this.rng)
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy)
    if (dist < 40) return
    const duration = Math.min(6000, Math.max(1500, (dist / WANDER_SPEED) * 1000))
    // Fly in a gentle arc rather than a straight line.
    const arc = Math.min(60, dist * 0.15) * (this.rng() < 0.5 ? -1 : 1)
    const normal = { x: -dy / dist, y: dx / dist }
    const started = Date.now()

    this.takeOff('wander', dx >= 0 ? 1 : -1)
    this.step = () => {
      const t = Math.min(1, (Date.now() - started) / duration)
      const e = easeInOut(t)
      const lift = Math.sin(Math.PI * t) * arc
      this.moveTo({ x: from.x + dx * e + normal.x * lift, y: from.y + dy * e + normal.y * lift })
      if (t >= 1) this.endFlight()
    }
  }

  private follow(durationMs: number): void {
    const until = Date.now() + durationMs
    let side: 1 | -1 = this.win.anchor().x > screen.getCursorScreenPoint().x ? 1 : -1
    this.takeOff('follow', 0)
    this.step = () => {
      if (Date.now() > until) return this.endFlight()
      const cursor = screen.getCursorScreenPoint()
      const target = followTarget(cursor, side, screen.getDisplayNearestPoint(cursor).workArea)
      side = target.side
      this.steerTo(target.anchor, 0.07, 11)
    }
  }

  /** Pick a spot on some window and fly there. False if there's nowhere to sit. */
  private flyToPerch(): boolean {
    const spot = pickPerch(this.ledges(), (l) => screen.getDisplayMatching(l).workArea, this.rng)
    if (!spot) return false
    this.takeOff('toPerch', 0)
    this.updateWatchRate()
    this.step = () => {
      const ledge = this.ledges().find((l) => l.id === spot.id)
      if (!ledge) return this.endFlight()
      const target = perchAnchor(ledge, spot.offsetX)
      if (Math.hypot(target.x - this.pos.x, target.y - this.pos.y) < 2) {
        this.endFlight()
        this.settleOn(ledge, spot.offsetX)
        if (this.rng() < 0.4) this.say('perch')
        return
      }
      this.steerTo(target, 0.1, 12)
    }
    return true
  }

  private takeOff(mode: Exclude<Mode, 'idle' | 'walk' | 'fall'>, dir: MotionInfo['dir']): void {
    this.perch = null
    this.mode = mode
    this.pos = this.win.anchor()
    this.sendMotion('flying', dir)
    if ((mode === 'wander' || mode === 'follow') && this.rng() < (mode === 'follow' ? 0.35 : 0.15)) this.say(mode)
    this.ensureFrames()
  }

  private endFlight(): void {
    if (this.mode === 'idle') return
    this.mode = 'idle'
    this.step = null
    this.sendMotion('still', 0)
    this.quietUntil = Math.max(this.quietUntil, Date.now() + QUIET_AFTER_LANDING_MS)
    this.win.savePosition()
    this.updateWatchRate()
  }

  /** Stop whatever it's doing in the air or on a ledge (but stay perched). */
  private stopMoving(): void {
    if (this.mode === 'walk') {
      this.mode = 'idle'
      this.step = null
      this.sendMotion('still', 0)
    } else if (this.mode !== 'idle' && this.mode !== 'fall') {
      this.endFlight()
    }
  }

  private interrupt(kind: 'hover' | 'drag' | 'panel'): void {
    this.quietUntil = Math.max(this.quietUntil, Date.now() + QUIET_AFTER_INTERACTION_MS)
    if (kind === 'drag') {
      // Picked up: whatever it was standing on or doing, it's in the user's hand now.
      this.step = null
      this.mode = 'idle'
      this.perch = null
      this.sendMotion('still', 0)
      this.updateWatchRate()
      return
    }
    this.stopMoving()
  }

  // ---- Sitting and walking on windows

  private ledges(): Ledge[] {
    return this.desktop.current().windows
  }

  private settleOn(ledge: Ledge, offsetX: number): void {
    this.perch = { id: ledge.id, offsetX }
    this.pos = perchAnchor(ledge, offsetX)
    this.win.moveAnchor(this.pos)
    this.updateWatchRate()
    this.ensureFrames()
  }

  private leavePerch(): void {
    this.stopMoving()
    this.perch = null
    this.win.savePosition()
    this.updateWatchRate()
  }

  /** Stay glued to the window: ride along when it moves, fall off when it goes. */
  private ride(): void {
    if (!this.perch || !this.win.canFly()) return
    const ledges = this.ledges()
    const index = ledges.findIndex((l) => l.id === this.perch?.id)
    if (index < 0) return this.fall()
    const ledge = ledges[index]
    const area = screen.getDisplayMatching(ledge).workArea
    if (!isUsable(ledge, area)) return this.fall()
    this.perch.offsetX = clampOffset(ledge, this.perch.offsetX, area)
    if (isCovered(ledges, index, ledge.x + this.perch.offsetX)) return this.fall()
    const target = perchAnchor(ledge, this.perch.offsetX)
    // Window positions arrive ~10×/s; glide between them.
    this.moveTo({ x: this.pos.x + (target.x - this.pos.x) * 0.45, y: this.pos.y + (target.y - this.pos.y) * 0.45 })
  }

  private startWalk(): void {
    const perch = this.perch
    if (!perch) return
    const ledges = this.ledges()
    const index = ledges.findIndex((l) => l.id === perch.id)
    if (index < 0) return
    const area = screen.getDisplayMatching(ledges[index]).workArea
    const span = uncoveredSpans(ledges, index, area).find(([a, b]) => perch.offsetX >= a - 1 && perch.offsetX <= b + 1)
    if (!span) return
    const distance = 60 + this.rng() * 200
    const dir = this.rng() < 0.5 ? -1 : 1
    const goal = Math.min(Math.max(perch.offsetX + dir * distance, span[0]), span[1])
    if (Math.abs(goal - perch.offsetX) < 20) return
    this.mode = 'walk'
    this.sendMotion('walking', goal > perch.offsetX ? 1 : -1)
    this.step = (dt) => {
      if (!this.perch) return this.stopMoving()
      const remaining = goal - this.perch.offsetX
      const stride = WALK_SPEED * dt
      if (Math.abs(remaining) <= stride) {
        this.perch.offsetX = goal
        this.stopMoving()
      } else {
        this.perch.offsetX += Math.sign(remaining) * stride
      }
    }
  }

  /** The window it was on went away (or it slid off): fall until it lands on something. */
  private fall(): void {
    this.perch = null
    this.mode = 'fall'
    this.pos = this.win.anchor()
    let vy = 0
    this.sendMotion('falling', 0)
    if (this.rng() < 0.6) this.say('fall')
    this.updateWatchRate()
    this.step = (dt) => {
      const before = feetOf(this.pos)
      vy = Math.min(vy + FALL_GRAVITY * dt, MAX_FALL_SPEED)
      const next = { x: this.pos.x, y: this.pos.y + vy * dt }
      const feet = feetOf(next)
      const area = screen.getDisplayNearestPoint(feet).workArea
      const ledge = this.settings.get().perchOnWindows ? ledgeCrossed(this.ledges(), feet.x, before.y, feet.y, area) : null
      const floor = anchorBounds(area).maxY
      if (ledge) {
        this.landed()
        this.settleOn(ledge, feet.x - ledge.x)
      } else if (next.y >= floor) {
        this.moveTo({ x: next.x, y: floor })
        this.landed()
      } else {
        this.moveTo(next)
      }
    }
  }

  private landed(): void {
    this.mode = 'idle'
    this.step = null
    this.sendMotion('still', 0)
    this.win.savePosition()
    this.quietUntil = Math.max(this.quietUntil, Date.now() + QUIET_AFTER_LANDING_MS)
    if (this.rng() < 0.6) this.say('land')
    this.updateWatchRate()
  }

  /** The user let go of the pet: if that's right on top of a window, sit on it. */
  private dropped(): void {
    if (!this.settings.get().perchOnWindows) return
    const feet = feetOf(this.win.anchor())
    const ledges = this.ledges()
    const area = this.win.workArea()
    const index = ledges.findIndex(
      (l, i) =>
        isUsable(l, area) &&
        Math.abs(feet.y - l.y) <= DROP_SNAP_PX &&
        feet.x >= l.x + 20 &&
        feet.x <= l.x + l.width - 20 &&
        !isCovered(ledges, i, feet.x)
    )
    if (index < 0) return
    const ledge = ledges[index]
    this.settleOn(ledge, clampOffset(ledge, feet.x - ledge.x, area))
  }

  // ---- Frame loop & plumbing

  private ensureFrames(): void {
    if (this.frameTimer) return
    this.lastFrame = Date.now()
    this.frameTimer = setInterval(() => this.frame(), FRAME_MS)
  }

  private stopFrames(): void {
    if (this.frameTimer) clearInterval(this.frameTimer)
    this.frameTimer = null
  }

  private frame(): void {
    const now = Date.now()
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    // Flights end if a panel opens or the pet is hidden or picked up.
    if (this.mode !== 'idle' && this.mode !== 'fall' && this.mode !== 'walk' && !this.win.canFly()) {
      this.endFlight()
    }
    this.step?.(dt)
    if (this.perch && (this.mode === 'idle' || this.mode === 'walk')) this.ride()
    if (this.mode === 'idle' && !this.perch) this.stopFrames()
  }

  private steerTo(goal: Point, ease: number, maxStep: number): void {
    let vx = (goal.x - this.pos.x) * ease
    let vy = (goal.y - this.pos.y) * ease
    const speed = Math.hypot(vx, vy)
    if (speed > maxStep) {
      vx = (vx / speed) * maxStep
      vy = (vy / speed) * maxStep
    }
    this.moveTo({ x: this.pos.x + vx, y: this.pos.y + vy })
    this.sendMotion('flying', Math.abs(vx) > 1 ? (vx > 0 ? 1 : -1) : 0)
  }

  private moveTo(p: Point): void {
    this.pos = p
    this.win.moveAnchor(p)
  }

  private sendMotion(state: MotionInfo['state'], dir: MotionInfo['dir']): void {
    if (state === this.motion.state && dir === this.motion.dir) return
    this.motion = { state, dir }
    this.win.send(IPC.windowMotion, this.motion)
  }

  private say(kind: Say): void {
    this.pets.roamRemark(kind)
  }

  /** Ask for fresh window positions only while they matter. */
  private updateWatchRate(): void {
    if (!DesktopWatcher.supported) return
    const s = this.settings.get()
    const riding = this.perch !== null || this.mode === 'toPerch' || this.mode === 'fall'
    this.desktop.want('roamer', riding ? 'fast' : s.perchOnWindows && s.roam ? 'slow' : 'off')
  }
}
