import type { Memory, NewMemory } from '../types/memory'
import { DAY } from '../utils/time'

/** Memories below this importance are not worth keeping. */
export const MIN_IMPORTANCE = 35

const TRIVIAL = /^(hi+|hey+|hello+|yo|sup|lol+|lmao|haha+|ok(ay)?|k|yes|yeah|yep|no|nope|nah|thanks?|ty|cool|nice|hm+|what are you doing\??|how are you\??|good (morning|night)|bye|gn|brb|\W*)$/i

/** Small talk that should never become a long-term memory. */
export function isTrivial(message: string): boolean {
  const text = message.trim()
  return text.length < 4 || TRIVIAL.test(text)
}

const STOP_WORDS = new Set(
  'the and you your are was were for with that this have has had not but what when where who how why can could would should about just like from they them then than there their our out get got its it’s i’m im dont don’t'.split(
    ' '
  )
)

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}']+/u)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  )
}

/**
 * Pick the memories most worth putting in front of the AI:
 * important ones, recent ones, and ones related to what was just said.
 */
export function selectMemories(all: readonly Memory[], query: string, now: number, limit = 12): Memory[] {
  const words = keywords(query)
  const scored = all.map((m) => {
    const ageDays = (now - m.timestamp) / DAY
    const recency = Math.max(0, 20 - ageDays * 2)
    let overlap = 0
    for (const w of keywords(m.content)) if (words.has(w)) overlap += 1
    return { m, score: m.importance + recency + overlap * 25 }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored
    .slice(0, limit)
    .map((s) => s.m)
    .sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Cheap pattern-based extraction so obvious facts are remembered even without
 * an AI brain (or when the AI forgets to flag them).
 */
export function heuristicMemories(message: string, ownerName: string, now: number): NewMemory[] {
  const text = message.trim()
  const who = ownerName || 'My human'
  const found: NewMemory[] = []

  const name = extractOwnerName(text)
  if (name) {
    found.push({ timestamp: now, type: 'user_fact', content: `My human's name is ${name}`, importance: 95 })
  }

  const fav = text.match(/\bmy fav(?:ou?rite)?\s+([\p{L} ]{2,25}?)\s+is\s+([^.!?,]{2,40})/iu)
  if (fav) {
    found.push({
      timestamp: now,
      type: 'preference',
      content: `${who}'s favourite ${fav[1].trim()} is ${fav[2].trim()}`,
      importance: 65
    })
  }

  const likes = text.match(/\bi (?:really )?(love|like|hate|dislike|can't stand)\s+([^.!?,]{3,40})/iu)
  if (likes && !/^(you|it|that|this|them|him|her|when|to)\b/i.test(likes[2]) && !/\byou\b/i.test(likes[2])) {
    const verb = likes[1].toLowerCase().replace("can't stand", 'hates')
    const phrase = verb.endsWith('s') ? verb : `${verb}s`
    found.push({ timestamp: now, type: 'preference', content: `${who} ${phrase} ${likes[2].trim()}`, importance: 55 })
  }

  const birthday = text.match(/\bmy birthday is\s+([^.!?]{3,30})/i)
  if (birthday) {
    found.push({ timestamp: now, type: 'user_fact', content: `${who}'s birthday is ${birthday[1].trim()}`, importance: 85 })
  }

  const remember = text.match(/\bremember (?:that )?([^.!?]{5,120})/i)
  if (remember) {
    found.push({ timestamp: now, type: 'user_fact', content: remember[1].trim(), importance: 75 })
  }

  return found
}

const NOT_NAMES = new Set(['not', 'a', 'an', 'the', 'so', 'very', 'just', 'also', 'maybe', 'back', 'later', 'when', 'if'])

/** Extract a name the user introduced themselves with, if any. */
export function extractOwnerName(message: string): string | null {
  const m = message.match(/\b(?:my name is|call me|i am called|i'm called)\s+([\p{L}][\p{L}'-]{1,20})/iu)
  if (!m || NOT_NAMES.has(m[1].toLowerCase())) return null
  return capitalise(m[1])
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
