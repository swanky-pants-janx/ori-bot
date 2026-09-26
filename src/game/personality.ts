import { TRAIT_KEYS, type PetActionType, type Personality, type TraitKey } from '../types/pet'
import { clamp, type Rng } from '../utils/math'

/** Every pet is born a little different. Traits start near the middle. */
export function randomPersonality(rng: Rng = Math.random): Personality {
  const trait = (): number => Math.round(clamp(50 + (rng() + rng() - 1) * 30, 15, 85))
  return {
    friendliness: trait(),
    playfulness: trait(),
    curiosity: trait(),
    stubbornness: trait(),
    affection: trait(),
    energy: trait()
  }
}

type TraitNudge = Partial<Record<TraitKey, number>>

/** How each kind of interaction slowly shapes character. Deliberately tiny. */
const NUDGES: Record<PetActionType | 'chat' | 'shake', TraitNudge> = {
  feed: { friendliness: 0.15 },
  pet: { affection: 0.25, friendliness: 0.1 },
  play: { playfulness: 0.25, energy: 0.1 },
  clean: { stubbornness: -0.05 },
  sleep: { energy: 0.05 },
  wake: { stubbornness: 0.2 },
  chat: { curiosity: 0.2, friendliness: 0.1 },
  shake: { stubbornness: 0.15, affection: -0.1 }
}

export type NudgeKind = keyof typeof NUDGES

export function nudgePersonality(p: Personality, kind: NudgeKind): Personality {
  return applyTraitDelta(p, NUDGES[kind])
}

export function applyTraitDelta(p: Personality, delta: TraitNudge, scale = 1): Personality {
  const next = { ...p }
  for (const key of TRAIT_KEYS) {
    const d = delta[key]
    if (d) next[key] = clamp(next[key] + d * scale)
  }
  return next
}

/** [very low, low, high, very high] */
const TRAIT_WORDS: Record<TraitKey, [string, string, string, string]> = {
  friendliness: ['shy and wary', 'a bit shy', 'friendly', 'warm and friendly'],
  playfulness: ['calm and mellow', 'fairly calm', 'playful', 'very playful'],
  curiosity: ['wary of new things', 'a bit cautious', 'curious', 'endlessly curious'],
  stubbornness: ['very easygoing', 'easygoing', 'a bit stubborn', 'stubborn and strong-willed'],
  affection: ['independent', 'a bit independent', 'affectionate', 'very cuddly'],
  energy: ['sleepy and low-energy', 'a bit low-energy', 'energetic', 'bouncy and full of energy']
}

/** Natural-language summary of the traits that stand out, for prompts and UI. */
export function describePersonality(p: Personality): string {
  const parts: string[] = []
  for (const key of TRAIT_KEYS) {
    const v = p[key]
    const [veryLow, low, high, veryHigh] = TRAIT_WORDS[key]
    if (v >= 75) parts.push(veryHigh)
    else if (v >= 60) parts.push(high)
    else if (v <= 25) parts.push(veryLow)
    else if (v <= 40) parts.push(low)
  }
  return parts.length > 0 ? parts.join(', ') : 'balanced and even-tempered'
}
