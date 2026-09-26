import type { Activity, LifeStage, Mood, PetState, Personality } from '../types/pet'
import { LIFE_STAGES, THRESHOLDS } from './tuning'

export interface MoodInputs {
  state: PetState
  personality: Personality
  activity: Activity | null
  annoyed: boolean
  dizzy: boolean
}

/**
 * The visible mood is always derived from real game state – never stored.
 * Order matters: the most urgent condition wins.
 */
export function deriveMood({ state, personality, activity, annoyed, dizzy }: MoodInputs): Mood {
  if (state.sleeping) return 'sleeping'
  if (dizzy) return 'dizzy'
  if (activity?.type === 'eating') return 'eating'
  if (activity?.type === 'playing') return 'playing'
  if (annoyed) return 'angry'
  if (state.health < THRESHOLDS.sick) return 'sick'
  if (state.hunger < THRESHOLDS.hungry) return 'hungry'
  if (state.energy < THRESHOLDS.tired) return 'sleepy'
  if (state.happiness < THRESHOLDS.sad) return 'sad'
  if (activity?.type === 'petted' || activity?.type === 'bathing') return 'happy'

  // Playful pets get excited more easily.
  const excitedAt = 92 - personality.playfulness / 10
  if (state.happiness >= excitedAt && state.energy > 50) return 'excited'
  if (state.happiness >= 65) return 'happy'
  return 'idle'
}

export function lifeStageForAge(ageDays: number): LifeStage {
  let stage: LifeStage = 'baby'
  for (const entry of LIFE_STAGES) {
    if (ageDays >= entry.minDays) stage = entry.stage
  }
  return stage
}
