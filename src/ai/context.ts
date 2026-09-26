import type { ChatMessage } from '../types/chat'
import type { PetEvent } from '../types/events'
import type { Memory } from '../types/memory'
import type { PetSnapshot } from '../types/pet'
import type { AIContext } from './types'

export interface ContextInputs {
  snapshot: PetSnapshot
  /** What the pet is with its current look (e.g. "bunny moth"). */
  species: string
  userActivity?: string | null
  ownerName: string
  memories: Memory[]
  conversation: ChatMessage[]
  events: PetEvent[]
  now: number
}

/** Snapshot the authoritative game state into what the AI gets to know. */
export function buildAIContext({
  snapshot,
  species,
  userActivity = null,
  ownerName,
  memories,
  conversation,
  events,
  now
}: ContextInputs): AIContext {
  const s = snapshot.state
  return {
    pet: {
      name: snapshot.info.name,
      species,
      ageDays: s.age,
      lifeStage: snapshot.lifeStage,
      mood: snapshot.mood,
      sleeping: s.sleeping,
      hunger: Math.round(s.hunger),
      happiness: Math.round(s.happiness),
      energy: Math.round(s.energy),
      health: Math.round(s.health),
      cleanliness: Math.round(s.cleanliness),
      affection: Math.round(s.affection)
    },
    ownerName,
    personality: snapshot.personality,
    recentMemories: memories,
    recentConversation: conversation,
    recentEvents: events,
    userActivity,
    localTime: new Date(now).toLocaleString('en-GB', {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

/** Providers expect alternating turns starting with the user. */
export function normaliseTurns(messages: ChatMessage[]): ChatMessage[] {
  const out = [...messages]
  while (out.length > 0 && out[0].role !== 'user') out.shift()
  return out
}
