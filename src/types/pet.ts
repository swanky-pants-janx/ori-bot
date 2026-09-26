/** All pet stats use the same scale: 0 = terrible, 100 = excellent. */
export const STAT_KEYS = ['hunger', 'happiness', 'energy', 'health', 'cleanliness', 'affection'] as const
export type StatKey = (typeof STAT_KEYS)[number]

export type PetStats = Record<StatKey, number>

export interface PetState extends PetStats {
  /** Age in days (fractional). */
  age: number
  sleeping: boolean
  /** Epoch ms of the last time the simulation was advanced. */
  lastUpdated: number
  /** Epoch ms of the last time the user cared for / talked to the pet. */
  lastInteraction: number
}

export const TRAIT_KEYS = [
  'friendliness',
  'playfulness',
  'curiosity',
  'stubbornness',
  'affection',
  'energy'
] as const
export type TraitKey = (typeof TRAIT_KEYS)[number]

/** Slow-moving character traits, 0–100. */
export type Personality = Record<TraitKey, number>

export interface PetInfo {
  id: number
  name: string
  species: string
  createdAt: number
  birthday: number
}

export const MOOD_IDS = [
  'idle',
  'happy',
  'excited',
  'sad',
  'hungry',
  'sleepy',
  'angry',
  'sick',
  'dizzy',
  'eating',
  'playing',
  'sleeping'
] as const
export type Mood = (typeof MOOD_IDS)[number]

export const LIFE_STAGE_IDS = ['baby', 'child', 'teen', 'adult'] as const
export type LifeStage = (typeof LIFE_STAGE_IDS)[number]

export const PET_ACTIONS = ['feed', 'pet', 'play', 'sleep', 'wake', 'clean'] as const
export type PetActionType = (typeof PET_ACTIONS)[number]

/** Short-lived visible activity triggered by an action. */
export type ActivityType = 'eating' | 'playing' | 'bathing' | 'petted'

export interface Activity {
  type: ActivityType
  until: number
}

/** Something the pet is asking the user for (usually raised by the AI brain). */
export type PetRequestType = 'REQUEST_FOOD' | 'REQUEST_PLAY' | 'REQUEST_SLEEP' | 'REQUEST_PET' | 'REQUEST_CLEAN'

export interface PetRequest {
  type: PetRequestType
  /** The action that fulfils this request. */
  action: PetActionType
  until: number
}

/** Everything the UI needs to draw the pet. Produced by the engine, never mutated by the UI. */
export interface PetSnapshot {
  info: PetInfo
  state: PetState
  personality: Personality
  mood: Mood
  lifeStage: LifeStage
  activity: Activity | null
  request: PetRequest | null
  annoyed: boolean
  now: number
}

/** Needs presets that aren't moods (moods have their own cheat). */
export const CHEAT_NEEDS = ['full', 'dirty'] as const
export type CheatNeed = (typeof CHEAT_NEEDS)[number]

/** Developer/fun shortcuts. Applied by the engine like any other change. */
export type Cheat =
  | { kind: 'grow'; stage: LifeStage }
  | { kind: 'skip'; hours: number }
  | { kind: 'needs'; preset: CheatNeed }
  | { kind: 'mood'; mood: Mood }

export type RefusalReason =
  | 'asleep'
  | 'awake'
  | 'full'
  | 'tired'
  | 'not_tired'
  | 'sick'
  | 'starving'
  | 'grumpy'
  | 'already_clean'

export interface ActionResult {
  ok: boolean
  action: PetActionType
  reason?: RefusalReason
  /** What the pet says in reaction, if anything. */
  speech?: string
  snapshot: PetSnapshot
}
