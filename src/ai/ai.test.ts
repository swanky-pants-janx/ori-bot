import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import type { Memory } from '../types/memory'
import { extractOwnerName, heuristicMemories, isTrivial, selectMemories } from './memory'
import { contextPrompt, parseReply, PET_INSTRUCTIONS } from './prompt'
import { AnthropicProvider } from './providers/anthropic'
import { OllamaProvider } from './providers/ollama'
import type { AIContext } from './types'

const NOW = Date.UTC(2026, 8, 24, 12)

const context: AIContext = {
  pet: {
    name: 'Ori',
    species: 'bunny moth',
    ageDays: 3.4,
    lifeStage: 'child',
    mood: 'hungry',
    sleeping: false,
    hunger: 12,
    happiness: 60,
    energy: 80,
    health: 90,
    cleanliness: 70,
    affection: 65
  },
  ownerName: 'Janx',
  personality: { friendliness: 80, playfulness: 50, curiosity: 50, stubbornness: 20, affection: 50, energy: 50 },
  recentMemories: [{ id: 1, timestamp: NOW, type: 'user_fact', content: "Janx's favourite food is ramen", importance: 70 }],
  recentConversation: [],
  recentEvents: [{ type: 'PET_FED', timestamp: NOW - 3 * 3600_000, message: 'Janx fed Ori.' }],
  localTime: 'Thursday 14:00',
  userActivity: 'coding in VS Code'
}

describe('parseReply', () => {
  it('reads a well-formed structured reply', () => {
    const r = parseReply(
      JSON.stringify({
        message: "I'm hungry!",
        emotion: 'sad',
        action: 'REQUEST_FOOD',
        remember: { content: 'Janx likes ramen', importance: 60, type: 'preference' }
      })
    )
    expect(r).toEqual({
      message: "I'm hungry!",
      emotion: 'sad',
      action: 'REQUEST_FOOD',
      remember: { content: 'Janx likes ramen', importance: 60, type: 'preference' }
    })
  })

  it('drops unknown actions and emotions instead of trusting the model', () => {
    const r = parseReply('{"message":"hi","emotion":"furious","action":"SET_HEALTH_100","remember":null}')
    expect(r.action).toBeNull()
    expect(r.emotion).toBeNull()
  })

  it('recovers JSON wrapped in extra text and falls back to plain text', () => {
    expect(parseReply('Sure! {"message":"hey","emotion":"happy","action":null,"remember":null}').message).toBe('hey')
    expect(parseReply('just words')).toMatchObject({ message: 'just words', action: null })
  })

  it('clamps memory importance', () => {
    const r = parseReply('{"message":"ok","emotion":"happy","action":null,"remember":{"content":"x y z","importance":500,"type":"??"}}')
    expect(r.remember).toEqual({ content: 'x y z', importance: 100, type: 'user_fact' })
  })
})

describe('prompt', () => {
  it('describes state in words, never numbers', () => {
    const text = contextPrompt(context, NOW)
    expect(text).toContain('very hungry')
    expect(text).toContain('Janx fed Ori')
    expect(text).toContain('3 hours ago')
    expect(text).toContain('ramen')
    expect(text).toContain('transgender bunny moth (he/him)')
    expect(text).toContain('What Janx is doing right now: coding in VS Code')
    expect(text).not.toMatch(/\b12\b/)
  })

  it('keeps stable instructions free of per-request data (cache friendly)', () => {
    expect(PET_INSTRUCTIONS).not.toContain('Ori')
    expect(PET_INSTRUCTIONS).toContain('REQUEST_FOOD')
    expect(PET_INSTRUCTIONS).toContain('Afrikaans')
  })
})

describe('memory', () => {
  it('ignores small talk', () => {
    expect(isTrivial('lol')).toBe(true)
    expect(isTrivial('hello')).toBe(true)
    expect(isTrivial('what are you doing?')).toBe(true)
    expect(isTrivial('I just got a new job at the bakery!')).toBe(false)
  })

  it('extracts obvious facts', () => {
    const found = heuristicMemories("Hi! My name is janx and my favourite food is ramen. I love hiking", 'Janx', NOW)
    expect(found.map((m) => m.content)).toEqual([
      "My human's name is Janx",
      "Janx's favourite food is ramen",
      'Janx loves hiking'
    ])
    expect(extractOwnerName('call me maybe')).toBeNull()
    expect(heuristicMemories('I like it', 'Janx', NOW)).toEqual([])
  })

  it('prefers important, recent and related memories', () => {
    const m = (id: number, content: string, importance: number, daysAgo: number): Memory => ({
      id,
      content,
      importance,
      type: 'user_fact',
      timestamp: NOW - daysAgo * 86_400_000
    })
    const all = [
      m(1, "My human's name is Janx", 95, 30),
      m(2, 'Janx has a cat called Miso', 50, 20),
      m(3, 'Janx watched a movie', 36, 25),
      m(4, 'Janx likes green tea', 45, 0)
    ]
    const picked = selectMemories(all, 'how is my cat doing?', NOW, 3).map((x) => x.id)
    expect(picked).toContain(1)
    expect(picked).toContain(2)
    expect(picked).not.toContain(3)
  })
})

// ---- Providers against local mock servers (no network, no API key needed)

let server: Server | null = null
afterEach(() => {
  server?.close()
  server = null
})

async function mockServer(
  handler: (req: IncomingMessage, body: Record<string, unknown>) => { status?: number; json: unknown }
): Promise<string> {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const { status = 200, json } = handler(req, raw ? JSON.parse(raw) : {})
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(json))
    })
  })
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`
}

const reply = { message: 'Hi Janx!', emotion: 'happy', action: null, remember: null }
const turns = [{ role: 'user' as const, content: 'hello', timestamp: NOW }]

describe('AnthropicProvider', () => {
  it('sends structured-output, low-effort requests with refusal fallbacks and cached instructions', async () => {
    let seen: { headers: IncomingMessage['headers']; body: Record<string, unknown> } | null = null
    const url = await mockServer((req, body) => {
      seen = { headers: req.headers, body }
      return {
        json: {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5',
          content: [{ type: 'text', text: JSON.stringify(reply) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 }
        }
      }
    })

    const text = await new AnthropicProvider('test-key', 'claude-opus-5', url).chat(turns, context)
    expect(parseReply(text).message).toBe('Hi Janx!')

    const { headers, body } = seen!
    expect(headers['x-api-key']).toBe('test-key')
    expect(String(headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01')
    expect(body.model).toBe('claude-opus-5')
    expect(body.fallbacks).toBe('default')
    expect(body.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } })
    const system = body.system as { text: string; cache_control?: unknown }[]
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(system[1].text).toContain('<pet_context>')
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }])
  })

  it('omits fallbacks and effort for models that do not support them', async () => {
    let body: Record<string, unknown> = {}
    const url = await mockServer((_req, b) => {
      body = b
      return {
        json: {
          id: 'm',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5',
          content: [{ type: 'text', text: JSON.stringify(reply) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 }
        }
      }
    })
    await new AnthropicProvider('k', 'claude-haiku-4-5', url).chat(turns, context)
    expect(body.fallbacks).toBeUndefined()
    expect(body.output_config).not.toHaveProperty('effort')
  })

  it('treats a refusal as an error and maps auth failures', async () => {
    const refusal = await mockServer(() => ({
      json: {
        id: 'm',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5',
        content: [],
        stop_reason: 'refusal',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 0 }
      }
    }))
    await expect(new AnthropicProvider('k', 'claude-opus-5', refusal).chat(turns, context)).rejects.toMatchObject({
      kind: 'refused'
    })
    server?.close()

    const denied = await mockServer(() => ({
      status: 401,
      json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }
    }))
    await expect(new AnthropicProvider('bad', 'claude-opus-5', denied).chat(turns, context)).rejects.toMatchObject({
      kind: 'auth'
    })
  })
})

describe('OllamaProvider', () => {
  it('calls /api/chat with the JSON schema and system prompt', async () => {
    let body: Record<string, unknown> = {}
    const url = await mockServer((_req, b) => {
      body = b
      return { json: { message: { role: 'assistant', content: JSON.stringify(reply) } } }
    })
    const text = await new OllamaProvider(url, 'llama3.2').chat(turns, context)
    expect(parseReply(text).message).toBe('Hi Janx!')
    expect(body).toMatchObject({ model: 'llama3.2', stream: false })
    expect((body.format as { type: string }).type).toBe('object')
    const msgs = body.messages as { role: string; content: string }[]
    expect(msgs[0].role).toBe('system')
    expect(msgs[1]).toEqual({ role: 'user', content: 'hello' })
  })

  it('explains a missing model', async () => {
    const url = await mockServer(() => ({ status: 404, json: { error: 'model not found' } }))
    await expect(new OllamaProvider(url, 'nope').chat(turns, context)).rejects.toThrow('ollama pull nope')
  })

  it('explains when Ollama is not running', async () => {
    await expect(new OllamaProvider('http://127.0.0.1:9', 'llama3.2').chat(turns, context)).rejects.toMatchObject({
      kind: 'network'
    })
  })
})
