import type { ChatMessage, Emotion } from '../types/chat'
import type { PetEvent } from '../types/events'
import type { Memory, MemoryType } from '../types/memory'
import type { LifeStage, Mood, PetRequestType, Personality } from '../types/pet'
import type { AIProviderId } from '../types/settings'

/** Everything the brain is told about the world. Built fresh for every request. */
export interface AIContext {
  pet: {
    name: string
    species: string
    ageDays: number
    lifeStage: LifeStage
    mood: Mood
    sleeping: boolean
    hunger: number
    happiness: number
    energy: number
    health: number
    cleanliness: number
    affection: number
  }
  ownerName: string
  personality: Personality
  recentMemories: Memory[]
  recentConversation: ChatMessage[]
  recentEvents: PetEvent[]
  /** Local time, e.g. "Tuesday 14:05". */
  localTime: string
  /** What the user is doing right now (app awareness), e.g. "coding in VS Code". */
  userActivity: string | null
}

/**
 * A pluggable brain. Providers only turn (messages + context) into raw model
 * text; parsing and validation happen in one shared place.
 */
export interface AIProvider {
  readonly id: Exclude<AIProviderId, 'none'>
  readonly label: string
  chat(messages: ChatMessage[], context: AIContext, signal?: AbortSignal): Promise<string>
}

/** The structured reply every provider is asked to produce. */
export interface PetReply {
  message: string
  emotion: Emotion | null
  /** The pet may *ask* for something; the game engine decides if it's valid. */
  action: PetRequestType | null
  remember: { content: string; importance: number; type: MemoryType } | null
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'network' | 'rate_limit' | 'refused' | 'bad_response' | 'config' | 'unknown'
  ) {
    super(message)
    this.name = 'AIError'
  }
}
