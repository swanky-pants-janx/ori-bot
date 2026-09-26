import type { ActivityType, CheatNeed, LifeStage, Mood, PetState } from '../types/pet'
import { AUTO_SLEEP, LIFE_STAGES } from './tuning'

/** Age (in days) that puts the pet comfortably inside a life stage. */
export function ageForStage(stage: LifeStage): number {
  const entry = LIFE_STAGES.find((s) => s.stage === stage) ?? LIFE_STAGES[0]
  return entry.minDays + 0.5
}

const NEEDS: Record<CheatNeed, Partial<PetState>> = {
  full: { hunger: 100, happiness: 100, energy: 100, health: 100, cleanliness: 100, affection: 100 },
  dirty: { cleanliness: 10 }
}

/** Pure state change for the needs presets. */
export function applyNeedsPreset(state: PetState, preset: CheatNeed): PetState {
  return { ...state, ...NEEDS[preset] }
}

export interface MoodCheat {
  state: PetState
  /** Short-lived moods are produced by an activity, being annoyed or being shaken. */
  activity?: ActivityType
  annoyed?: boolean
  dizzy?: boolean
}

/**
 * Change the real state so the derived mood becomes `mood`. Only needs that
 * would otherwise win (see deriveMood) are raised; everything else is kept.
 */
export function applyMoodCheat(state: PetState, mood: Mood): MoodCheat {
  const s: PetState = { ...state, sleeping: false }
  const atLeast = (key: 'hunger' | 'energy' | 'health', min: number): void => {
    s[key] = Math.max(s[key], min)
  }
  // Raise any need that would take priority over (or disrupt) the chosen mood,
  // e.g. very low energy would make the pet fall asleep on the next tick.
  if (mood !== 'sick') atLeast('health', 60)
  if (mood !== 'hungry') atLeast('hunger', 60)
  if (mood !== 'sleepy') atLeast('energy', 60)

  switch (mood) {
    case 'idle':
      return { state: { ...s, happiness: 55 } }
    case 'happy':
      return { state: { ...s, happiness: 75 } }
    case 'excited':
      return { state: { ...s, happiness: 100, energy: Math.max(s.energy, 90) } }
    case 'sad':
      return { state: { ...s, happiness: 15 } }
    case 'hungry':
      return { state: { ...s, hunger: 10 } }
    case 'sleepy':
      // Just above the auto-sleep threshold so it's visibly sleepy, not asleep.
      return { state: { ...s, energy: AUTO_SLEEP.fallAsleepBelow + 2 } }
    case 'sick':
      return { state: { ...s, health: 15 } }
    case 'sleeping':
      // Tired enough that it won't wake straight back up.
      return { state: { ...s, sleeping: true, energy: Math.min(s.energy, 40) } }
    case 'angry':
      return { state: s, annoyed: true }
    case 'dizzy':
      return { state: s, dizzy: true }
    case 'eating':
      return { state: s, activity: 'eating' }
    case 'playing':
      return { state: s, activity: 'playing' }
  }
}
