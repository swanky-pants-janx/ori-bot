import { screen, type WebContents } from 'electron'
import type { PetService } from '../../services/petService'
import { IPC, type BallStatus } from '../../types/api'
import type { Roamer } from '../roamer'
import type { PetWindow } from '../window'
import { BallToy } from './ball'

/** Put the ball away if nobody has touched it for this long. */
const IDLE_MS = 60_000
/** How long the pet holds on to a caught ball before tossing it back. */
const HOLD_BALL_MS = 1500

/**
 * Playtime with a real, throwable ball: the user throws it, the pet flies
 * after it, catches it, plays, and tosses it back. The game engine still
 * decides whether the pet *can* play.
 */
export class Toys {
  private ball: BallToy | null = null
  private idleTimer: ReturnType<typeof setTimeout> | undefined
  private readonly rng = Math.random

  constructor(
    private readonly petWin: PetWindow,
    private readonly roamer: Roamer,
    private readonly pets: PetService
  ) {
    petWin.win.on('hide', () => this.dismissBall())
  }

  /** Whether an IPC message came from one of the toy windows. */
  owns(sender: WebContents): boolean {
    return !!this.ball && !this.ball.win.isDestroyed() && this.ball.win.webContents === sender
  }

  spawnBall(): void {
    if (this.ball) return
    const c = this.petWin.petCenter()
    const ball = new BallToy({ x: c.x - 70, y: c.y - 40 })
    ball.onGrab = () => {
      this.roamer.stopChase()
      this.touched()
    }
    ball.onRelease = () => this.fetch(ball)
    this.ball = ball
    this.roamer.setHold('ball', true)
    this.status('out')
    this.touched()
  }

  dismissBall(): void {
    clearTimeout(this.idleTimer)
    if (!this.ball) return
    const ball = this.ball
    this.ball = null
    this.roamer.stopChase()
    this.roamer.setHold('ball', false)
    ball.vanish()
    this.status('none')
  }

  grab(): void {
    this.ball?.grab()
  }

  release(): void {
    this.ball?.release()
  }

  destroy(): void {
    clearTimeout(this.idleTimer)
    this.ball?.destroy()
    this.ball = null
  }

  /** Thrown (or dropped): go get it – if the pet is up for playing. */
  private fetch(ball: BallToy): void {
    this.touched()
    if (!this.pets.check('play').ok) return
    if (this.rng() < 0.5) this.pets.roamRemark('chase')
    this.roamer.chase(
      () => (this.ball === ball ? ball.center() : null),
      () => this.caught(ball)
    )
  }

  private caught(ball: BallToy): void {
    if (this.ball !== ball) return
    this.touched()
    ball.carry(() => {
      const c = this.petWin.petCenter()
      return { x: c.x + 24, y: c.y + 30 }
    })
    this.pets.act('play')
    setTimeout(() => {
      if (this.ball !== ball) return
      // Toss it back towards the middle of the screen.
      const c = this.petWin.petCenter()
      const area = screen.getDisplayNearestPoint(c).workArea
      const dir = c.x > area.x + area.width / 2 ? -1 : 1
      ball.drop(dir * (320 + this.rng() * 380), -850 - this.rng() * 350)
    }, HOLD_BALL_MS)
  }

  private touched(): void {
    clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.dismissBall(), IDLE_MS)
  }

  private status(status: BallStatus): void {
    this.petWin.send(IPC.toyBall, status)
  }
}
