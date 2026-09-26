export const MEMORY_TYPES = ['user_fact', 'preference', 'event', 'topic', 'milestone'] as const
export type MemoryType = (typeof MEMORY_TYPES)[number]

export interface Memory {
  id: number
  timestamp: number
  type: MemoryType
  content: string
  /** 0–100. Higher is more likely to be recalled. */
  importance: number
}

export type NewMemory = Omit<Memory, 'id'>
