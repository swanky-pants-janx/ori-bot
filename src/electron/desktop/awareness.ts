import type { PetService } from '../../services/petService'
import type { SettingsService } from '../../services/settingsService'
import { IPC, type DesktopActivity } from '../../types/api'
import type { Roamer } from '../roamer'
import type { PetWindow } from '../window'
import { categorize, describeActivity } from './apps'
import { DesktopWatcher, type DesktopState, type FrontApp } from './watcher'

/** Only count an app switch once the user has stayed there a moment. */
const SETTLE_MS = 3000

/**
 * Notices which app is in front (by name only – never window titles or
 * contents, and nothing leaves the Mac) so the pet can react: chatter about
 * coding, dance to music, keep quiet during calls.
 */
export class AppAwareness {
  private current: { key: string; activity: DesktopActivity } | null = null
  private pendingKey: string | null = null
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly watcher: DesktopWatcher,
    private readonly settings: SettingsService,
    private readonly pets: PetService,
    private readonly roamer: Roamer,
    private readonly petWin: PetWindow
  ) {
    watcher.onChange((state) => this.observe(state))
    settings.onChange(() => this.apply())
    this.apply()
  }

  private get enabled(): boolean {
    return DesktopWatcher.supported && this.settings.get().appAwareness
  }

  private apply(): void {
    this.watcher.want('awareness', this.enabled ? 'slow' : 'off')
    if (!this.enabled && this.current) this.set(null)
    else if (this.enabled) this.observe(this.watcher.current())
  }

  private observe(state: DesktopState): void {
    if (!this.enabled || !state.front) return
    const front = state.front
    // Clicking the pet makes Ori the front app – that's not a switch.
    if (front.pid === process.pid) return
    const key = front.bundleId || front.name
    if (key === this.current?.key) {
      this.pendingKey = null
      clearTimeout(this.timer)
      return
    }
    if (key === this.pendingKey) return
    this.pendingKey = key
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.settle(front, key), SETTLE_MS)
  }

  private settle(front: FrontApp, key: string): void {
    if (!this.enabled || this.pendingKey !== key) return
    this.pendingKey = null
    this.set({ key, activity: { app: front.name, category: categorize(front) } })
  }

  private set(next: { key: string; activity: DesktopActivity } | null): void {
    this.current = next
    const activity = next?.activity ?? null
    this.petWin.send(IPC.desktopActivity, activity)
    this.pets.setActivity(activity, activity ? describeActivity(activity.app, activity.category) : '')
    this.roamer.setActivity(activity?.category ?? null)
  }

  stop(): void {
    clearTimeout(this.timer)
    this.watcher.want('awareness', 'off')
  }
}
