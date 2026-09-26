import type { Emotion } from '../../types/chat'
import type { ActivityType, Mood } from '../../types/pet'
import type { EyeKind, MouthKind } from './types'

export interface Expression {
  eyes: EyeKind
  mouth: MouthKind
  blush: boolean
}

const MOODS: Record<Mood, Expression> = {
  idle: { eyes: 'open', mouth: 'smile', blush: false },
  happy: { eyes: 'open', mouth: 'cat', blush: true },
  excited: { eyes: 'star', mouth: 'open', blush: true },
  sad: { eyes: 'sad', mouth: 'frown', blush: false },
  hungry: { eyes: 'open', mouth: 'wavy', blush: false },
  sleepy: { eyes: 'sleepy', mouth: 'flat', blush: false },
  angry: { eyes: 'angry', mouth: 'grit', blush: false },
  sick: { eyes: 'sleepy', mouth: 'wavy', blush: false },
  dizzy: { eyes: 'dizzy', mouth: 'wavy', blush: false },
  playing: { eyes: 'happy', mouth: 'open', blush: true },
  eating: { eyes: 'happy', mouth: 'chew', blush: true },
  sleeping: { eyes: 'closed', mouth: 'dot', blush: false }
}

const EMOTIONS: Record<Emotion, Expression> = {
  neutral: { eyes: 'open', mouth: 'smile', blush: false },
  happy: { eyes: 'happy', mouth: 'cat', blush: true },
  excited: { eyes: 'star', mouth: 'open', blush: true },
  love: { eyes: 'heart', mouth: 'cat', blush: true },
  sad: { eyes: 'sad', mouth: 'frown', blush: false },
  angry: { eyes: 'angry', mouth: 'grit', blush: false },
  sleepy: { eyes: 'sleepy', mouth: 'flat', blush: false },
  curious: { eyes: 'look', mouth: 'o', blush: false },
  surprised: { eyes: 'surprised', mouth: 'o', blush: false }
}

export interface ExpressionInputs {
  mood: Mood
  activity: ActivityType | null
  /** Short-lived emotion from something the pet just said. */
  emotion: Emotion | null
  held: boolean
  /** Tumbling off a window. */
  falling: boolean
  thinking: boolean
  /** An apple is being held near the mouth. */
  anticipating: boolean
  /** Being scrubbed with the sponge. */
  scrubbing: boolean
  blinking: boolean
  /** Animation frame counter, for munching etc. */
  frame: number
}

/** Decide the face to draw. Visual only – the game state is never changed here. */
export function expressionFor(i: ExpressionInputs): Expression {
  if (i.mood === 'dizzy') return MOODS.dizzy
  if (i.held || i.falling) return { eyes: 'surprised', mouth: 'o', blush: true }
  if (i.mood === 'sleeping') return MOODS.sleeping
  if (i.anticipating) return { eyes: 'star', mouth: 'open', blush: true } // "Aaah!"
  if (i.scrubbing) return { eyes: 'happy', mouth: 'cat', blush: true } // giggles

  let e: Expression
  if (i.mood === 'eating') e = { ...MOODS.eating, mouth: i.frame % 2 === 0 ? 'chew' : 'o' }
  else if (i.mood === 'playing') e = { ...MOODS.playing, eyes: i.frame % 4 < 2 ? 'happy' : 'star' }
  // Being annoyed wins over the afterglow of the last (welcome) pat.
  else if (i.mood === 'angry') e = MOODS.angry
  else if (i.activity === 'petted') e = { eyes: 'happy', mouth: 'cat', blush: true }
  else if (i.activity === 'bathing') e = { eyes: 'happy', mouth: 'open', blush: true }
  else if (i.thinking) e = EMOTIONS.curious
  else if (i.emotion) e = EMOTIONS[i.emotion]
  else e = MOODS[i.mood]

  if (i.blinking && (e.eyes === 'open' || e.eyes === 'look' || e.eyes === 'sad')) e = { ...e, eyes: 'blink' }
  return e
}

/** Eyes that can follow the cursor. */
export function canLook(eyes: EyeKind): boolean {
  return eyes === 'open' || eyes === 'sad' || eyes === 'angry' || eyes === 'surprised' || eyes === 'star' || eyes === 'look'
}
