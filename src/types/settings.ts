export const AI_PROVIDERS = ['none', 'anthropic', 'ollama'] as const
export type AIProviderId = (typeof AI_PROVIDERS)[number]

/** Providers that need an API key stored in the OS keychain. */
export const KEYED_PROVIDERS = ['anthropic'] as const
export type KeyedProviderId = (typeof KEYED_PROVIDERS)[number]

/** Available looks for the pet (artwork lives in the renderer). */
export const CREATURE_IDS = ['ori', 'moth'] as const
export type CreatureId = (typeof CREATURE_IDS)[number]

/** What the pet *is* with each look – used in its dialogue and by the AI. */
export const CREATURE_SPECIES: Readonly<Record<CreatureId, string>> = {
  ori: 'blob',
  moth: 'bunny moth'
}

export interface WindowPosition {
  x: number
  y: number
}

export interface Settings {
  ownerName: string
  creature: CreatureId
  aiProvider: AIProviderId
  anthropicModel: string
  ollamaModel: string
  ollamaUrl: string
  alwaysOnTop: boolean
  soundEnabled: boolean
  /** Spoken responses (text-to-speech). */
  voiceEnabled: boolean
  /** Talking to the pet with your voice (speech-to-text). */
  speechRecognitionEnabled: boolean
  startWithComputer: boolean
  startHidden: boolean
  /** Whether the pet makes spontaneous remarks. */
  chatty: boolean
  /** The pet flies around the screen on its own. */
  roam: boolean
  /** …and sometimes tags along after the cursor. */
  followCursor: boolean
  /** Lands on, sits on and walks along the tops of other windows (macOS). */
  perchOnWindows: boolean
  /** Notices which app is in front and reacts to it (macOS; app names only, stays local). */
  appAwareness: boolean
  windowPosition: WindowPosition | null
}

export const DEFAULT_SETTINGS: Settings = {
  ownerName: '',
  creature: 'ori',
  aiProvider: 'none',
  anthropicModel: 'claude-opus-5',
  ollamaModel: 'llama3.2',
  ollamaUrl: 'http://127.0.0.1:11434',
  alwaysOnTop: true,
  soundEnabled: true,
  voiceEnabled: false,
  speechRecognitionEnabled: false,
  startWithComputer: false,
  startHidden: false,
  chatty: true,
  roam: true,
  followCursor: true,
  perchOnWindows: true,
  appAwareness: false,
  windowPosition: null
}

export type SettingsPatch = Partial<Omit<Settings, 'windowPosition'>>

/** What the renderer is allowed to see. Secrets are reduced to booleans. */
export interface PublicSettings extends Settings {
  hasApiKey: Record<KeyedProviderId, boolean>
  secureStorageAvailable: boolean
  isPackaged: boolean
  platform: string
}
