import {
  AIError,
  buildAIContext,
  createProvider,
  extractOwnerName,
  heuristicMemories,
  isTrivial,
  MIN_IMPORTANCE,
  parseReply,
  selectMemories,
  type AIProvider
} from '../ai'
import { offlineReply } from '../ai/offline'
import type { Database } from '../database'
import { dialogue } from '../game'
import type { ChatMessage, ChatReply } from '../types/chat'
import type { PetEvent } from '../types/events'
import type { Memory, NewMemory } from '../types/memory'
import { DAY } from '../utils/time'
import type { PetService } from './petService'
import type { SettingsService } from './settingsService'

const HISTORY_EXCHANGES = 10
const MAX_MESSAGE_LENGTH = 1000

export type ProviderFactory = typeof createProvider

/** Talking to the pet: context building, the AI round trip, memory and history. */
export class ChatService {
  constructor(
    private readonly db: Database,
    private readonly pets: PetService,
    private readonly settings: SettingsService,
    private readonly clock: () => number = Date.now,
    private readonly providerFactory: ProviderFactory = createProvider
  ) {}

  async send(text: string): Promise<ChatReply> {
    const message = text.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!message) return { message: '...', emotion: null, request: null, source: 'offline' }

    const now = this.clock()
    this.pets.noteChat()

    // Learn the owner's name the moment they introduce themselves.
    const introduced = extractOwnerName(message)
    if (introduced && !this.settings.get().ownerName) this.settings.update({ ownerName: introduced })
    const owner = this.settings.get().ownerName

    let reply: ChatReply
    const provider = this.provider()
    if (!provider) {
      const offline = offlineReply(message, this.pets.snapshot(), this.pets.speaker())
      reply = { ...offline, request: null, source: 'offline' }
    } else {
      try {
        const history = this.history(HISTORY_EXCHANGES)
        const messages: ChatMessage[] = [...history, { role: 'user', content: message, timestamp: now }]
        const raw = await provider.chat(messages, this.context(messages, message, now))
        const parsed = parseReply(raw)
        const request = parsed.action && this.pets.requestFromAI(parsed.action) ? parsed.action : null
        if (parsed.remember && parsed.remember.importance >= MIN_IMPORTANCE && !isTrivial(message)) {
          this.remember({ ...parsed.remember, timestamp: now })
        }
        reply = { message: parsed.message, emotion: parsed.emotion, request, source: 'ai' }
      } catch (err) {
        const error = err instanceof AIError ? err.message : 'Something went wrong.'
        const offline = offlineReply(message, this.pets.snapshot(), this.pets.speaker())
        reply = { ...offline, emotion: 'curious', request: null, source: 'offline', error }
      }
    }

    if (!isTrivial(message)) {
      for (const m of heuristicMemories(message, owner, now)) this.remember(m)
    }
    this.db.conversations.add(this.pets.petId, { timestamp: now, userMessage: message, petResponse: reply.message })
    this.pets.say(reply.message, reply.source === 'ai' ? 'ai' : 'script', reply.emotion)
    return reply
  }

  /**
   * React out loud to an event (e.g. the user coming back). Uses the AI when
   * available so the greeting reflects memories and mood; falls back to a script.
   */
  async react(event: PetEvent): Promise<void> {
    const snapshot = this.pets.snapshot()
    if (snapshot.state.sleeping) return
    const fallback = (): void => {
      if (event.type === 'USER_RETURNED') {
        this.pets.say(dialogue.returnLine(Number(event.data?.ms ?? 0), this.pets.speaker()), 'script', 'happy')
      }
    }

    const provider = this.provider()
    if (!provider) return fallback()
    try {
      const now = this.clock()
      const history = this.history(4)
      const nudge: ChatMessage = {
        role: 'user',
        content: `(Nothing has been said yet. What just happened: ${event.message} React briefly, in character.)`,
        timestamp: now
      }
      const messages = [...history, nudge]
      const raw = await provider.chat(messages, this.context(messages, event.message, now), AbortSignal.timeout(20_000))
      const parsed = parseReply(raw)
      this.pets.say(parsed.message, 'ai', parsed.emotion)
    } catch {
      fallback()
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const s = this.settings.get()
    if (s.aiProvider === 'none') return { ok: false, message: 'AI is turned off.' }
    const provider = this.provider()
    if (!provider) return { ok: false, message: 'Add an API key first.' }
    try {
      const now = this.clock()
      const messages: ChatMessage[] = [{ role: 'user', content: '(Connection test. Say hi in five words or fewer.)', timestamp: now }]
      const raw = await provider.chat(messages, this.context(messages, '', now), AbortSignal.timeout(60_000))
      return { ok: true, message: parseReply(raw).message }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  /** Recent conversation as alternating chat messages, oldest first. */
  history(exchanges = 30): ChatMessage[] {
    return this.db.conversations.recent(this.pets.petId, exchanges).flatMap((c) => [
      { role: 'user' as const, content: c.userMessage, timestamp: c.timestamp },
      { role: 'pet' as const, content: c.petResponse, timestamp: c.timestamp }
    ])
  }

  clearHistory(): void {
    this.db.conversations.clear(this.pets.petId)
  }

  listMemories(): Memory[] {
    return this.db.memories.list(this.pets.petId, 500)
  }

  deleteMemory(id: number): void {
    this.db.memories.delete(this.pets.petId, id)
  }

  private provider(): AIProvider | null {
    return this.providerFactory(this.settings.get(), (p) => this.settings.getApiKey(p))
  }

  private context(conversation: ChatMessage[], query: string, now: number) {
    return buildAIContext({
      snapshot: this.pets.snapshot(),
      species: this.pets.speaker().species,
      userActivity: this.pets.activityDescription(),
      ownerName: this.settings.get().ownerName,
      memories: selectMemories(this.db.memories.list(this.pets.petId, 300), query, now),
      conversation,
      events: this.pets.recentEvents(12, 2 * DAY),
      now
    })
  }

  private remember(m: NewMemory): void {
    const petId = this.pets.petId
    const existing = this.db.memories.findByContent(petId, m.content)
    if (existing) {
      this.db.memories.update(existing.id, {
        content: existing.content,
        importance: Math.max(existing.importance, m.importance),
        timestamp: m.timestamp
      })
    } else {
      this.db.memories.add(petId, m)
    }
  }
}
