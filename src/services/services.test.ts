import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AIProvider } from '../ai'
import { createDatabase } from '../database'
import type { ChatMessage } from '../types/chat'
import type { AIContext } from '../ai/types'
import { HOUR } from '../utils/time'
import { ChatService, type ProviderFactory } from './chatService'
import { PetService } from './petService'
import { SettingsService, type SecretStore } from './settingsService'

const T0 = Date.UTC(2026, 8, 24, 9)

const fakeSecrets: SecretStore = {
  available: () => true,
  encrypt: (s) => Buffer.from(s).toString('base64'),
  decrypt: (s) => Buffer.from(s, 'base64').toString()
}

function setup(file = ':memory:') {
  let now = T0
  const clock = (): number => now
  const db = createDatabase(file)
  const settings = new SettingsService(db.settings, fakeSecrets, { isPackaged: false, platform: 'darwin' })
  const pets = new PetService(db, settings, clock, () => 0.5)
  return { db, settings, pets, clock, advance: (ms: number) => (now += ms), setNow: (t: number) => (now = t) }
}

class FakeBrain implements AIProvider {
  readonly id = 'anthropic' as const
  readonly label = 'Fake'
  calls: { messages: ChatMessage[]; context: AIContext }[] = []
  constructor(private readonly reply: object | Error) {}
  async chat(messages: ChatMessage[], context: AIContext): Promise<string> {
    this.calls.push({ messages, context })
    if (this.reply instanceof Error) throw this.reply
    return JSON.stringify(this.reply)
  }
}

const withBrain =
  (brain: AIProvider): ProviderFactory =>
  () =>
    brain

describe('PetService', () => {
  it('hatches a pet on first launch and persists across restarts with offline progression', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ori-svc-'))
    const dir = join(tmp, 'ori.db')
    const first = setup(dir)
    expect(first.pets.init().hatched).toBe(true)
    first.pets.act('pet')
    const hunger = first.pets.snapshot().state.hunger
    first.pets.stop()
    first.db.close()

    const second = setup(dir)
    second.setNow(T0 + 6 * HOUR)
    const { awayMs, hatched } = second.pets.init()
    expect(hatched).toBe(false)
    expect(awayMs).toBe(6 * HOUR)
    expect(second.pets.snapshot().state.hunger).toBeCloseTo(hunger - 24, 0)
    second.db.close()
    rmSync(tmp, { recursive: true, force: true })
  })

  it('speaks when acting and records events', () => {
    const { pets, db } = setup()
    pets.init()
    const said: string[] = []
    pets.onSpeech((s) => said.push(s.text))
    const result = pets.act('feed')
    expect(result.ok).toBe(true)
    expect(said).toHaveLength(1)
    expect(db.events.recent(pets.petId, 5).some((e) => e.type === 'PET_FED')).toBe(true)
  })
})

describe('chattiness', () => {
  afterEach(() => vi.useRealTimers())

  /** Count unprompted lines over a stretch of simulated time. */
  function chatterOver(mood: 'excited' | 'idle', minutes: number, chatAt?: number): number {
    vi.useFakeTimers({ now: T0 })
    let seed = 7
    const rng = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647
    const db = createDatabase(':memory:')
    const settings = new SettingsService(db.settings, fakeSecrets, { isPackaged: false, platform: 'darwin' })
    const pets = new PetService(db, settings, () => Date.now(), rng)
    pets.init()
    pets.cheat({ kind: 'mood', mood })
    let lines = 0
    pets.onSpeech(() => lines++)
    pets.start()
    if (chatAt !== undefined) {
      vi.advanceTimersByTime(chatAt)
      pets.noteChat()
    }
    vi.advanceTimersByTime(minutes * 60_000 - (chatAt ?? 0))
    pets.stop()
    db.close()
    return lines
  }

  it('chatters away when excited and stays fairly quiet when content', () => {
    const excited = chatterOver('excited', 20)
    const idle = chatterOver('idle', 20)
    expect(excited).toBeGreaterThan(15)
    expect(idle).toBeLessThan(6)
    expect(excited).toBeGreaterThan(idle * 4)
  })

  it("doesn't chatter over a conversation", () => {
    expect(chatterOver('excited', 1.4, 1000)).toBe(0)
  })
})

describe('SettingsService', () => {
  it('sanitises input and never exposes secrets', () => {
    const { settings } = setup()
    settings.update({ aiProvider: 'bogus' as never, ollamaUrl: 'javascript:alert(1)', ownerName: '  Janx  ' })
    expect(settings.get().aiProvider).toBe('none')
    expect(settings.get().ollamaUrl).toBe('http://127.0.0.1:11434')
    expect(settings.get().ownerName).toBe('Janx')

    settings.setApiKey('anthropic', 'sk-ant-secret')
    expect(settings.getApiKey('anthropic')).toBe('sk-ant-secret')
    const pub = settings.toPublic()
    expect(pub.hasApiKey.anthropic).toBe(true)
    expect(JSON.stringify(pub)).not.toContain('sk-ant-secret')
  })
})

describe('ChatService', () => {
  it('builds context from real game state and applies valid AI requests + memories', async () => {
    const { db, settings, pets, clock } = setup()
    pets.init()
    settings.update({ aiProvider: 'anthropic', ownerName: 'Janx' })
    // Make the pet genuinely hungry so REQUEST_FOOD is valid.
    db.pets.saveState(pets.petId, { ...pets.snapshot().state, hunger: 30 })
    pets.init()

    const brain = new FakeBrain({
      message: 'Can I have a snack?',
      emotion: 'happy',
      action: 'REQUEST_FOOD',
      remember: { content: 'Janx is learning to bake bread', importance: 70, type: 'user_fact' }
    })
    const chat = new ChatService(db, pets, settings, clock, withBrain(brain))
    const reply = await chat.send("I'm learning to bake bread!")

    expect(reply).toMatchObject({ message: 'Can I have a snack?', request: 'REQUEST_FOOD', source: 'ai' })
    expect(pets.snapshot().request?.action).toBe('feed')
    expect(brain.calls[0].context.pet.hunger).toBe(30)
    expect(brain.calls[0].context.ownerName).toBe('Janx')
    expect(db.memories.list(pets.petId).map((m) => m.content)).toContain('Janx is learning to bake bread')
    expect(chat.history().map((m) => m.content)).toEqual(["I'm learning to bake bread!", 'Can I have a snack?'])
  })

  it('rejects requests that contradict the game state', async () => {
    const { db, settings, pets, clock } = setup()
    pets.init()
    settings.update({ aiProvider: 'anthropic' })
    const brain = new FakeBrain({ message: 'Feed me!', emotion: 'sad', action: 'REQUEST_FOOD', remember: null })
    const reply = await new ChatService(db, pets, settings, clock, withBrain(brain)).send('hey there buddy')
    expect(reply.request).toBeNull() // freshly hatched pet isn't hungry
    expect(pets.snapshot().request).toBeNull()
  })

  it('falls back to the offline brain when AI is off or fails, and still learns the owner name', async () => {
    const { db, settings, pets, clock } = setup()
    pets.init()
    const offline = await new ChatService(db, pets, settings, clock, () => null).send('hello! my name is Janx')
    expect(offline.source).toBe('offline')
    expect(settings.get().ownerName).toBe('Janx')

    settings.update({ aiProvider: 'anthropic' })
    const broken = new ChatService(db, pets, settings, clock, withBrain(new FakeBrain(new Error('boom'))))
    const reply = await broken.send('how are you?')
    expect(reply.source).toBe('offline')
    expect(reply.error).toBeDefined()
  })
})
