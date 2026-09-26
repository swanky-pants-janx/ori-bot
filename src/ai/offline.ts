import type { Emotion } from '../types/chat'
import type { PetSnapshot } from '../types/pet'
import { moodLine, type Speaker } from '../game/dialogue'
import { pick, type Rng } from '../utils/math'

export interface OfflineReply {
  message: string
  emotion: Emotion
}

const SHRUGS = ['*kop skeef*', 'Hmm?', '*knik knik*', '*knip oë*', 'Ooh!', '*wiggle*', 'Ja-ja!', 'Lekker!', 'Wow, dit is so cool']

/**
 * A tiny rule-based "brain" used when no AI provider is configured (or it fails).
 * It keeps the pet feeling alive – in its own Afrikaans-English – without
 * pretending to understand everything.
 */
export function offlineReply(message: string, snapshot: PetSnapshot, who: Speaker, rng: Rng = Math.random): OfflineReply {
  const text = message.toLowerCase()
  const owner = who.owner || 'vriend'

  if (snapshot.state.sleeping) return { message: pick(['Zzz...', '*snork*', 'mmh... slaap...'], rng), emotion: 'sleepy' }
  // Specific topics first, so "hi! who are you?" answers the question.
  if (/your name|who are you|wie is jy|what are you/.test(text)) {
    return { message: `Ek is ${who.name}!`, emotion: 'happy' }
  }
  if (/how are you|how do you feel|you ok|hoe gaan dit/.test(text)) {
    return { message: moodLine(snapshot.mood, who, rng) ?? 'Ek is lekker!', emotion: 'neutral' }
  }
  if (/part(y|ies)|dance|dans/.test(text)) return { message: 'Ek hou van party!', emotion: 'excited' }
  if (/love you|lief vir jou|good (boy|girl|pet)|cute|oulik/.test(text)) {
    return { message: pick(['*bloos* ♥', 'Ek is ook lief vir jou!'], rng), emotion: 'love' }
  }
  if (/hungry|food|eat|honger|kos/.test(text)) {
    return {
      message: snapshot.state.hunger < 50 ? 'Kos? Ja please!' : 'Ek is nie honger nie, dankie!',
      emotion: 'excited'
    }
  }
  if (/play|game|speel/.test(text)) return { message: 'Speel? Speel!! Whooo!!', emotion: 'excited' }
  if (/\b(bye|goodnight|night|see you|totsiens|nag)\b/.test(text)) {
    return { message: `Totsiens, ${owner}!`, emotion: 'sad' }
  }
  if (/\b(hi|hey|hello|yo|haai|hallo|morning|môre|evening)\b/.test(text)) {
    return { message: pick([`Haai ${owner}!`, 'Hallo hallo!', 'Haaaai!', `Ek is ${who.name}!`], rng), emotion: 'happy' }
  }
  return { message: pick(SHRUGS, rng), emotion: 'curious' }
}
