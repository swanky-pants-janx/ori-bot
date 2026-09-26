import type { PetState, Personality } from '../types/pet'
import { clamp } from '../utils/math'
import { HOUR } from '../utils/time'
import { CONSEQUENCES as C, DECAY } from './tuning'

/**
 * Advance needs by `hours` of real time. Pure: returns a new state.
 * `now` is the time at the end of the step (used for neglect).
 */
export function applyNeeds(state: PetState, personality: Personality, hours: number, now: number): PetState {
  const rates = state.sleeping ? DECAY.asleep : DECAY.awake
  // Naturally energetic pets tire more slowly (0.8x – 1.2x).
  const staminaFactor = 1.2 - personality.energy / 250

  const next: PetState = { ...state }
  next.hunger -= rates.hunger * hours
  next.energy -= (rates.energy > 0 ? rates.energy * staminaFactor : rates.energy) * hours
  next.cleanliness -= rates.cleanliness * hours
  next.happiness -= rates.happiness * hours

  let affectionLoss = rates.affection
  const hoursAlone = (now - state.lastInteraction) / HOUR
  if (!state.sleeping && hoursAlone > DECAY.neglectAfterHours) affectionLoss += DECAY.neglectedAffection
  next.affection -= affectionLoss * hours

  // Unmet needs have knock-on effects, judged on the state at the start of the step.
  if (state.hunger < C.hungryBelow) next.happiness -= C.hungryHappiness * hours
  if (state.hunger < C.starvingBelow) next.health -= C.starvingHealth * hours
  if (state.cleanliness < C.dirtyBelow) next.happiness -= C.dirtyHappiness * hours
  if (state.cleanliness < C.filthyBelow) next.health -= C.filthyHealth * hours
  if (!state.sleeping && state.energy < C.exhaustedBelow) {
    next.happiness -= C.exhaustedHappiness * hours
    next.health -= C.exhaustedHealth * hours
  }
  if (state.happiness < C.miserableBelow) next.health -= C.miserableHealth * hours

  const r = C.recoverWhen
  if (state.hunger >= r.hunger && state.cleanliness >= r.cleanliness && state.energy >= r.energy) {
    next.health += C.recoverHealth * hours
  }

  next.hunger = clamp(next.hunger)
  next.energy = clamp(next.energy)
  next.cleanliness = clamp(next.cleanliness)
  next.happiness = clamp(next.happiness)
  next.affection = clamp(next.affection)
  next.health = clamp(next.health)
  next.age = state.age + hours / 24
  next.lastUpdated = now
  return next
}
