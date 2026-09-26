import type { ChatMessage, ChatReply, Speech } from './chat'
import type { Memory } from './memory'
import type { ActionResult, Cheat, PetActionType, PetSnapshot } from './pet'
import type { KeyedProviderId, PublicSettings, SettingsPatch } from './settings'

export type PanelName = 'chat' | 'stats' | 'settings'
/** Where the open panel sits relative to the pet, chosen by available screen space. */
export type PanelLayout = 'none' | 'above' | 'below'

/** How the pet is moving around the desktop; `dir` is which way it's heading. */
export interface MotionInfo {
  state: 'still' | 'flying' | 'walking' | 'falling'
  dir: -1 | 0 | 1
}

export const APP_CATEGORIES = [
  'code',
  'music',
  'call',
  'video',
  'browse',
  'chat',
  'design',
  'write',
  'game',
  'other'
] as const
export type AppCategory = (typeof APP_CATEGORIES)[number]

/** What the user is doing, as far as app awareness can tell (app name only). */
export interface DesktopActivity {
  app: string
  category: AppCategory
}

export type FlightMode = 'wander' | 'follow' | 'perch'

/** Whether the throwable ball is out on the screen. */
export type BallStatus = 'none' | 'out'

export interface CursorInfo {
  /** Cursor position relative to the pet's centre, in screen pixels. */
  dx: number
  dy: number
}

type Unsubscribe = () => void

/** The complete, typed surface exposed to the renderer as `window.ori`. */
export interface OriApi {
  pet: {
    getSnapshot(): Promise<PetSnapshot>
    act(action: PetActionType): Promise<ActionResult>
    rename(name: string): Promise<PetSnapshot>
    adoptNew(name: string): Promise<PetSnapshot>
    cheat(cheat: Cheat): Promise<PetSnapshot>
    /** Would this action work right now? If not, the pet says why. */
    check(action: PetActionType): Promise<{ ok: boolean; reason?: string }>
    onSnapshot(cb: (snapshot: PetSnapshot) => void): Unsubscribe
    onSpeech(cb: (speech: Speech) => void): Unsubscribe
  }
  chat: {
    send(message: string): Promise<ChatReply>
    history(limit?: number): Promise<ChatMessage[]>
    clear(): Promise<void>
  }
  memory: {
    list(): Promise<Memory[]>
    delete(id: number): Promise<void>
  }
  settings: {
    get(): Promise<PublicSettings>
    update(patch: SettingsPatch): Promise<PublicSettings>
    setApiKey(provider: KeyedProviderId, key: string): Promise<PublicSettings>
    clearApiKey(provider: KeyedProviderId): Promise<PublicSettings>
    testAI(): Promise<{ ok: boolean; message: string }>
    onChange(cb: (settings: PublicSettings) => void): Unsubscribe
  }
  toy: {
    spawnBall(): void
    dismissBall(): void
    /** From the ball's own window: picked up / let go. */
    grab(): void
    release(): void
    onBall(cb: (status: BallStatus) => void): Unsubscribe
    /** Ball window: play the disappear animation. */
    onVanish(cb: () => void): Unsubscribe
  }
  window: {
    /** The UI has mounted and subscribed; queued messages can be delivered. */
    ready(): void
    dragStart(): void
    dragEnd(): void
    setIgnoreMouse(ignore: boolean): void
    setPanel(panel: PanelName | null): Promise<PanelLayout>
    hide(): void
    resetPosition(): void
    /** Cheat: take off right now. */
    fly(mode: FlightMode): void
    /** The user is busy with a toy (apple, sponge) – don't fly off. */
    setBusy(busy: boolean): void
    onCursor(cb: (cursor: CursorInfo) => void): Unsubscribe
    onMotion(cb: (motion: MotionInfo) => void): Unsubscribe
    /** App awareness: the app in front changed (null when off). */
    onActivity(cb: (activity: DesktopActivity | null) => void): Unsubscribe
    onOpenPanel(cb: (panel: PanelName) => void): Unsubscribe
  }
}

export const IPC = {
  petGetSnapshot: 'pet:get-snapshot',
  petAct: 'pet:act',
  petRename: 'pet:rename',
  petAdoptNew: 'pet:adopt-new',
  petCheat: 'pet:cheat',
  petCheck: 'pet:check',
  petSnapshot: 'pet:snapshot',
  petSpeech: 'pet:speech',
  chatSend: 'chat:send',
  chatHistory: 'chat:history',
  chatClear: 'chat:clear',
  memoryList: 'memory:list',
  memoryDelete: 'memory:delete',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsSetApiKey: 'settings:set-api-key',
  settingsClearApiKey: 'settings:clear-api-key',
  settingsTestAI: 'settings:test-ai',
  settingsChanged: 'settings:changed',
  windowDragStart: 'window:drag-start',
  windowDragEnd: 'window:drag-end',
  windowIgnoreMouse: 'window:ignore-mouse',
  windowSetPanel: 'window:set-panel',
  windowHide: 'window:hide',
  windowResetPosition: 'window:reset-position',
  windowCursor: 'window:cursor',
  windowMotion: 'window:motion',
  desktopActivity: 'desktop:activity',
  windowFly: 'window:fly',
  windowBusy: 'window:busy',
  toySpawnBall: 'toy:spawn-ball',
  toyDismissBall: 'toy:dismiss-ball',
  toyGrab: 'toy:grab',
  toyRelease: 'toy:release',
  toyBall: 'toy:ball',
  toyVanish: 'toy:vanish',
  uiOpenPanel: 'ui:open-panel',
  uiReady: 'ui:ready'
} as const
