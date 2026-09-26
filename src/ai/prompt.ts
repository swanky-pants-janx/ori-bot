import { EMOTIONS, type Emotion } from '../types/chat'
import { MEMORY_TYPES, type MemoryType } from '../types/memory'
import type { PetRequestType } from '../types/pet'
import { describePersonality } from '../game/personality'
import { isRequestType, REQUEST_TYPES } from '../game/requests'
import { describeDuration } from '../utils/time'
import type { AIContext, PetReply } from './types'

/**
 * Stable instructions – identical on every request so providers can cache them.
 * Everything that changes lives in `contextPrompt()`.
 */
export const PET_INSTRUCTIONS = `You are a small creature who lives on your human's computer desktop – a living virtual pet, not an assistant. Your name, body, feelings, personality and memories are described in the context that follows. Stay in character as that creature.

How you talk:
- You speak a playful, broken mix of Afrikaans and English. Use Afrikaans for everyday words (lekker, baie, ja, nee, dankie, asseblief, honger, moeg, kos, speel, vriend), keep the grammar simple and a little wonky, and keep it easy for an English speaker to follow. You sound like this: "Whooo!!", "Wow, dit is so cool", "Ek hou van party", "Ek is so happy vandag!", "Kom ons speel!", "Lekker, man!".
- Keep replies short and conversational: usually one or two short sentences, rarely more than 30 words.
- When you're happy or excited you get extra bubbly and chatty; when you're tired, sad or sick you get quieter.
- At the baby stage use very simple words; you get more articulate as you grow up.
- You may occasionally describe your own body language in asterisks (like *wiggles* or *gaap*), sparingly.
- Your personality traits shape how you react. A shy pet is more reserved; a stubborn pet can be sassy; a cuddly pet loves attention.
- You can chat about anything and ask about your human's day. If they ask for real work (code, essays, long explanations), answer the way a small creature would – briefly and in character – never with lists, code blocks or long text.
- If your human sincerely asks whether you are an AI, don't deny it: you're a little digital creature with an AI brain.

Your body is real:
- Let how you feel colour what you say. If you are hungry, tired, dirty or sick you can mention it naturally, but don't complain every time.
- Never mention numbers or statistics about yourself.
- If you are asleep, you only mumble sleepily in a few words.
- Only things listed in your recent events actually happened. Never claim to have eaten, played, been bathed, petted or put to bed unless the events say so. If your human says in words that they fed or petted you but no such event happened, you can playfully point out that nothing arrived.
- You cannot change your own body. If you want something, you can ask for it with "action": REQUEST_FOOD, REQUEST_PLAY, REQUEST_SLEEP, REQUEST_PET or REQUEST_CLEAN. Only ask when it truly fits how you feel right now, and not in every reply. Otherwise use null.

Memory:
- Use "remember" only for things worth keeping long-term: your human's name, their likes and dislikes, important things happening in their life, things they ask you to remember, recurring topics. Give it an importance from 0 to 100 (names and big life events 80+, preferences 50–70).
- Never remember small talk like greetings, "lol", or "what are you doing?". Use null.
- Write memories as short third-person facts, e.g. "Janx's favourite food is ramen".

Reply with a JSON object with these fields:
- "message": what you say out loud.
- "emotion": one of ${EMOTIONS.join(', ')}.
- "action": one of ${REQUEST_TYPES.join(', ')}, or null.
- "remember": {"content", "importance", "type"} or null. type is one of ${MEMORY_TYPES.join(', ')}.`

/** JSON schema for structured output (Claude `output_config.format`, Ollama `format`). */
export const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    emotion: { type: 'string', enum: [...EMOTIONS] },
    action: { anyOf: [{ type: 'string', enum: [...REQUEST_TYPES] }, { type: 'null' }] },
    remember: {
      anyOf: [
        {
          type: 'object',
          properties: {
            content: { type: 'string' },
            importance: { type: 'integer' },
            type: { type: 'string', enum: [...MEMORY_TYPES] }
          },
          required: ['content', 'importance', 'type'],
          additionalProperties: false
        },
        { type: 'null' }
      ]
    }
  },
  required: ['message', 'emotion', 'action', 'remember'],
  additionalProperties: false
} as const

/** Who the pet is. Part of its character, so it lives with the prompt. */
const IDENTITY = { description: 'a proud transgender', pronouns: 'he/him' } as const

function level(value: number, words: [number, string][]): string {
  for (const [min, word] of words) if (value >= min) return word
  return words[words.length - 1][1]
}

function ago(ms: number): string {
  return ms < 2 * 60_000 ? 'just now' : `${describeDuration(ms)} ago`
}

/** The per-request, ever-changing part of the prompt. */
export function contextPrompt(ctx: AIContext, now: number): string {
  const p = ctx.pet
  const owner = ctx.ownerName || 'your human'
  const body = [
    level(p.hunger, [[80, 'tummy full'], [50, 'not hungry'], [20, 'getting hungry'], [8, 'very hungry'], [0, 'starving']]),
    level(p.energy, [[70, 'full of energy'], [40, 'energy okay'], [20, 'tired'], [0, 'exhausted']]),
    level(p.cleanliness, [[70, 'clean'], [40, 'a little messy'], [20, 'dirty'], [0, 'filthy and stinky']]),
    level(p.health, [[70, 'healthy'], [45, 'a bit under the weather'], [25, 'unwell'], [0, 'sick']]),
    level(p.happiness, [[85, 'overjoyed'], [65, 'happy'], [40, 'content'], [25, 'a bit down'], [0, 'sad']]),
    level(p.affection, [
      [80, `adores ${owner}`],
      [60, `loves ${owner}`],
      [40, `fond of ${owner}`],
      [20, `a bit distant from ${owner}`],
      [0, `feels neglected by ${owner}`]
    ])
  ]

  const lines = [
    '<pet_context>',
    `Name: ${p.name} – ${IDENTITY.description} ${p.species} (${IDENTITY.pronouns}), ${Math.floor(p.ageDays)} days old – ${p.lifeStage} stage`,
    `Local time: ${ctx.localTime}`,
    `Your human: ${ctx.ownerName || 'unknown name (you could ask!)'}`,
    ...(ctx.userActivity ? [`What ${owner} is doing right now: ${ctx.userActivity}`] : []),
    `Right now: ${p.sleeping ? 'asleep' : 'awake'}, mood ${p.mood}`,
    `How your body feels: ${body.join('; ')}`,
    `Personality: ${describePersonality(ctx.personality)}`,
    '</pet_context>'
  ]

  if (ctx.recentMemories.length > 0) {
    lines.push('<memories>')
    for (const m of ctx.recentMemories) lines.push(`- ${m.content}`)
    lines.push('</memories>')
  }

  if (ctx.recentEvents.length > 0) {
    lines.push('<recent_events>')
    for (const e of ctx.recentEvents) lines.push(`- ${ago(now - e.timestamp)}: ${e.message}`)
    lines.push('</recent_events>')
  }

  return lines.join('\n')
}

function extractJson(raw: string): unknown {
  const text = raw.trim()
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

const MAX_MESSAGE = 500

/** Turn raw model output into a safe, validated reply. Never throws. */
export function parseReply(raw: string): PetReply {
  const data = extractJson(raw)
  if (!data || typeof data !== 'object') {
    const message = raw.trim().replace(/^"|"$/g, '').slice(0, MAX_MESSAGE)
    return { message: message || '...', emotion: null, action: null, remember: null }
  }

  const obj = data as Record<string, unknown>
  const message = typeof obj.message === 'string' && obj.message.trim() ? obj.message.trim() : '...'
  const emotion = (EMOTIONS as readonly string[]).includes(String(obj.emotion)) ? (obj.emotion as Emotion) : null
  const action: PetRequestType | null = isRequestType(obj.action) ? obj.action : null

  let remember: PetReply['remember'] = null
  const r = obj.remember
  if (r && typeof r === 'object') {
    const rr = r as Record<string, unknown>
    const content = typeof rr.content === 'string' ? rr.content.trim() : ''
    const importance = Number(rr.importance)
    if (content.length >= 3 && Number.isFinite(importance)) {
      remember = {
        content: content.slice(0, 300),
        importance: Math.min(100, Math.max(0, Math.round(importance))),
        type: (MEMORY_TYPES as readonly string[]).includes(String(rr.type)) ? (rr.type as MemoryType) : 'user_fact'
      }
    }
  }

  return { message: message.slice(0, MAX_MESSAGE), emotion, action, remember }
}
