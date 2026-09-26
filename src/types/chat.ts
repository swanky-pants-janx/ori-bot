import type { PetRequestType } from './pet'

export type ChatRole = 'user' | 'pet'

export interface ChatMessage {
  role: ChatRole
  content: string
  timestamp: number
}

export interface Conversation {
  id: number
  timestamp: number
  userMessage: string
  petResponse: string
}

/** Expressions the AI may use to colour a reply. Purely visual – never changes stats. */
export const EMOTIONS = ['neutral', 'happy', 'excited', 'love', 'sad', 'angry', 'sleepy', 'curious', 'surprised'] as const
export type Emotion = (typeof EMOTIONS)[number]

export interface ChatReply {
  message: string
  emotion: Emotion | null
  /** A request the pet made that the game engine accepted. */
  request: PetRequestType | null
  source: 'ai' | 'offline'
  error?: string
}

/** Something the pet says out loud (speech bubble). */
export interface Speech {
  id: number
  text: string
  emotion: Emotion | null
  source: 'script' | 'ai'
}
