import { BrowserWindow, screen } from 'electron'
import { IPC } from '../../types/api'
import type { Point } from '../motion'
import { releaseVelocity, step, type Body, type Sample } from '../physics'
import { loadUi, SECURE_WEB_PREFERENCES } from '../renderer'

/** Size of the ball's window (the sprite is 44px). */
export const BALL_SIZE = 52
const FRAME_MS = 16
const HOLD_LIMIT_MS = 30_000

/**
 * A throwable ball in its own tiny always-on-top window, so it can fly across
 * the whole screen. Physics runs here in the main process.
 */
export class BallToy {
  readonly win: BrowserWindow
  private body: Body
  private held: { offset: Point; since: number } | null = null
  private carriedBy: (() => Point) | null = null
  private samples: Sample[] = []
  private resting = false
  private last = Date.now()
  private readonly timer: ReturnType<typeof setInterval>

  /** Picked up by the user. */
  onGrab: () => void = () => {}
  /** Let go (thrown or dropped). */
  onRelease: () => void = () => {}

  constructor(center: Point) {
    const half = BALL_SIZE / 2
    // Pop out with a little toss.
    this.body = { x: center.x - half, y: center.y - half, vx: -260, vy: -700 }
    this.win = new BrowserWindow({
      width: BALL_SIZE,
      height: BALL_SIZE,
      x: Math.round(this.body.x),
      y: Math.round(this.body.y),
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      show: false,
      alwaysOnTop: true,
      title: 'Ball',
      webPreferences: SECURE_WEB_PREFERENCES
    })
    this.win.setAlwaysOnTop(true, 'floating')
    if (process.platform === 'darwin') this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    this.win.once('ready-to-show', () => {
      this.win.showInactive()
      this.win.moveTop()
    })
    loadUi(this.win, 'ball')
    this.timer = setInterval(() => this.tick(), FRAME_MS)
  }

  center(): Point {
    return { x: this.body.x + BALL_SIZE / 2, y: this.body.y + BALL_SIZE / 2 }
  }

  grab(): void {
    const c = screen.getCursorScreenPoint()
    this.held = { offset: { x: c.x - this.body.x, y: c.y - this.body.y }, since: Date.now() }
    this.carriedBy = null
    this.samples = [{ ...c, t: Date.now() }]
    this.onGrab()
  }

  release(): void {
    if (!this.held) return
    const v = releaseVelocity(this.samples)
    this.body = { ...this.body, ...v }
    this.held = null
    this.resting = false
    this.onRelease()
  }

  /** Stick to a point (the pet's mouth) until dropped. */
  carry(follow: () => Point): void {
    this.held = null
    this.carriedBy = follow
  }

  drop(vx: number, vy: number): void {
    this.carriedBy = null
    this.body = { ...this.body, vx, vy }
    this.resting = false
  }

  /** Play the disappear animation, then close. */
  vanish(): void {
    clearInterval(this.timer)
    if (this.win.isDestroyed()) return
    this.win.webContents.send(IPC.toyVanish)
    setTimeout(() => this.destroy(), 300)
  }

  destroy(): void {
    clearInterval(this.timer)
    if (!this.win.isDestroyed()) this.win.destroy()
  }

  private tick(): void {
    if (this.win.isDestroyed()) return
    const now = Date.now()
    const dt = Math.min(0.033, (now - this.last) / 1000)
    this.last = now

    if (this.held) {
      const c = screen.getCursorScreenPoint()
      this.samples.push({ ...c, t: now })
      this.samples = this.samples.filter((s) => now - s.t <= 200)
      this.body = { ...this.body, x: c.x - this.held.offset.x, y: c.y - this.held.offset.y }
      // Never get stuck to the cursor if the mouse-up went missing.
      if (now - this.held.since > HOLD_LIMIT_MS) this.release()
    } else if (this.carriedBy) {
      const p = this.carriedBy()
      this.body = { x: p.x - BALL_SIZE / 2, y: p.y - BALL_SIZE / 2, vx: 0, vy: 0 }
    } else if (!this.resting) {
      // The screen the ball is on is its playground.
      const area = screen.getDisplayNearestPoint(this.center()).workArea
      const result = step(this.body, dt, {
        minX: area.x,
        maxX: area.x + area.width - BALL_SIZE,
        minY: area.y,
        maxY: area.y + area.height - BALL_SIZE
      })
      this.body = result.body
      this.resting = result.resting
    } else {
      return
    }
    this.win.setPosition(Math.round(this.body.x), Math.round(this.body.y))
  }
}
