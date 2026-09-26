import type { SettingsRepository } from '../database/settings'
import {
  AI_PROVIDERS,
  CREATURE_IDS,
  DEFAULT_SETTINGS,
  KEYED_PROVIDERS,
  type KeyedProviderId,
  type PublicSettings,
  type Settings,
  type SettingsPatch,
  type WindowPosition
} from '../types/settings'

/** Encrypts secrets at rest. Backed by Electron's safeStorage (OS keychain). */
export interface SecretStore {
  available(): boolean
  encrypt(plain: string): string
  decrypt(cipher: string): string
}

const SETTINGS_KEY = 'settings'
const secretKey = (p: KeyedProviderId): string => `secret:${p}`

function str(value: unknown, fallback: string, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function modelName(value: unknown, fallback: string): string {
  const s = str(value, fallback, 100)
  return /^[\w.:/-]+$/.test(s) ? s : fallback
}

function httpUrl(value: unknown, fallback: string): string {
  const s = str(value, fallback, 300)
  try {
    const url = new URL(s)
    return url.protocol === 'http:' || url.protocol === 'https:' ? s.replace(/\/+$/, '') : fallback
  } catch {
    return fallback
  }
}

/** Never trust stored or incoming values blindly. */
function sanitise(input: Partial<Record<keyof Settings, unknown>>, base: Settings): Settings {
  const pos = input.windowPosition as WindowPosition | null | undefined
  return {
    ownerName: str(input.ownerName, base.ownerName, 40),
    creature: (CREATURE_IDS as readonly unknown[]).includes(input.creature)
      ? (input.creature as Settings['creature'])
      : base.creature,
    aiProvider: (AI_PROVIDERS as readonly unknown[]).includes(input.aiProvider)
      ? (input.aiProvider as Settings['aiProvider'])
      : base.aiProvider,
    anthropicModel: modelName(input.anthropicModel, base.anthropicModel),
    ollamaModel: modelName(input.ollamaModel, base.ollamaModel),
    ollamaUrl: httpUrl(input.ollamaUrl, base.ollamaUrl),
    alwaysOnTop: bool(input.alwaysOnTop, base.alwaysOnTop),
    soundEnabled: bool(input.soundEnabled, base.soundEnabled),
    voiceEnabled: bool(input.voiceEnabled, base.voiceEnabled),
    speechRecognitionEnabled: bool(input.speechRecognitionEnabled, base.speechRecognitionEnabled),
    startWithComputer: bool(input.startWithComputer, base.startWithComputer),
    startHidden: bool(input.startHidden, base.startHidden),
    chatty: bool(input.chatty, base.chatty),
    roam: bool(input.roam, base.roam),
    followCursor: bool(input.followCursor, base.followCursor),
    perchOnWindows: bool(input.perchOnWindows, base.perchOnWindows),
    appAwareness: bool(input.appAwareness, base.appAwareness),
    windowPosition:
      pos === null
        ? null
        : pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)
          ? { x: Math.round(pos.x), y: Math.round(pos.y) }
          : base.windowPosition
  }
}

export class SettingsService {
  private settings: Settings
  private readonly listeners = new Set<(s: Settings) => void>()

  constructor(
    private readonly repo: SettingsRepository,
    private readonly secrets: SecretStore,
    private readonly env: { isPackaged: boolean; platform: string }
  ) {
    const stored = repo.get<Partial<Settings>>(SETTINGS_KEY) ?? {}
    this.settings = sanitise({ ...DEFAULT_SETTINGS, ...stored }, DEFAULT_SETTINGS)
  }

  get(): Settings {
    return this.settings
  }

  update(patch: SettingsPatch): Settings {
    const { windowPosition: _ignored, ...safePatch } = patch as SettingsPatch & { windowPosition?: unknown }
    this.settings = sanitise({ ...this.settings, ...safePatch }, this.settings)
    this.persist()
    return this.settings
  }

  /** Saved separately and silently: dragging the pet shouldn't spam listeners. */
  setWindowPosition(pos: WindowPosition | null): void {
    this.settings = sanitise({ ...this.settings, windowPosition: pos }, this.settings)
    this.repo.set(SETTINGS_KEY, this.settings)
  }

  getApiKey(provider: KeyedProviderId): string | null {
    const stored = this.repo.get<string>(secretKey(provider))
    if (!stored) return null
    try {
      if (stored.startsWith('enc:')) return this.secrets.decrypt(stored.slice(4))
      if (stored.startsWith('plain:')) return stored.slice(6)
    } catch {
      // Keychain unavailable or the key was encrypted by another machine/user.
    }
    return null
  }

  setApiKey(provider: KeyedProviderId, key: string): void {
    const clean = key.trim()
    if (!clean) return this.clearApiKey(provider)
    const value = this.secrets.available() ? `enc:${this.secrets.encrypt(clean)}` : `plain:${clean}`
    this.repo.set(secretKey(provider), value)
    this.notify()
  }

  clearApiKey(provider: KeyedProviderId): void {
    this.repo.delete(secretKey(provider))
    this.notify()
  }

  toPublic(): PublicSettings {
    const hasApiKey = Object.fromEntries(
      KEYED_PROVIDERS.map((p) => [p, this.repo.get<string>(secretKey(p)) !== undefined])
    ) as Record<KeyedProviderId, boolean>
    return {
      ...this.settings,
      hasApiKey,
      secureStorageAvailable: this.secrets.available(),
      isPackaged: this.env.isPackaged,
      platform: this.env.platform
    }
  }

  onChange(listener: (s: Settings) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private persist(): void {
    this.repo.set(SETTINGS_KEY, this.settings)
    this.notify()
  }

  private notify(): void {
    for (const l of this.listeners) l(this.settings)
  }
}
