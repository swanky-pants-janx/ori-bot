import type { BallStatus, CursorInfo, DesktopActivity, MotionInfo, PanelLayout, PanelName } from '../../types/api'
import type { Emotion, Speech } from '../../types/chat'
import type { PetSnapshot } from '../../types/pet'
import type { PublicSettings } from '../../types/settings'
import { api } from './api'

const EMOTION_MS = 3500

/** Reactive UI state. The main process stays authoritative; this only mirrors it. */
class AppState {
  snapshot = $state<PetSnapshot | null>(null)
  settings = $state<PublicSettings | null>(null)
  speech = $state<Speech | null>(null)
  panel = $state<PanelName | null>(null)
  layout = $state<PanelLayout>('none')
  cursor = $state<CursorInfo>({ dx: 0, dy: 0 })
  /** Flying around the desktop on its own. */
  motion = $state<MotionInfo>({ state: 'still', dir: 0 })
  /** What the user is doing (app awareness), or null. */
  activity = $state<DesktopActivity | null>(null)
  emotion = $state<Emotion | null>(null)
  /** The pet is being dragged around. */
  held = $state(false)
  /** Waiting for the AI brain to answer. */
  thinking = $state(false)
  /** Hands-on care: an apple to feed, or a sponge to wash with. */
  tool = $state<'apple' | 'sponge' | null>(null)
  /** Washing progress, 0–1. */
  scrub = $state(0)
  /** The sponge is rubbing the pet right now. */
  scrubbing = $state(false)
  /** An apple is being held close to the pet's mouth. */
  anticipating = $state(false)
  ball = $state<BallStatus>('none')

  private emotionTimer: ReturnType<typeof setTimeout> | undefined

  async init(): Promise<void> {
    api.pet.onSnapshot((s) => (this.snapshot = s))
    api.pet.onSpeech((s) => this.showSpeech(s))
    api.settings.onChange((s) => (this.settings = s))
    api.window.onCursor((c) => (this.cursor = c))
    api.window.onMotion((m) => (this.motion = m))
    api.window.onActivity((a) => (this.activity = a))
    api.toy.onBall((b) => (this.ball = b))
    api.window.onOpenPanel((p) => void this.openPanel(p))
    const [snapshot, settings] = await Promise.all([api.pet.getSnapshot(), api.settings.get()])
    this.snapshot = snapshot
    this.settings = settings
    api.window.ready()
  }

  showSpeech(speech: Speech): void {
    this.speech = speech
    if (speech.emotion) this.flashEmotion(speech.emotion)
  }

  flashEmotion(emotion: Emotion): void {
    clearTimeout(this.emotionTimer)
    this.emotion = emotion
    this.emotionTimer = setTimeout(() => (this.emotion = null), EMOTION_MS)
  }

  async openPanel(panel: PanelName): Promise<void> {
    if (this.panel === panel) return
    this.layout = await api.window.setPanel(panel)
    this.panel = panel
  }

  async closePanel(): Promise<void> {
    this.panel = null
    this.layout = await api.window.setPanel(null)
  }

  async togglePanel(panel: PanelName): Promise<void> {
    if (this.panel === panel) await this.closePanel()
    else await this.openPanel(panel)
  }
}

export const app = new AppState()
