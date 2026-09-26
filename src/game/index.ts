import type { PetState } from '../types/pet'

export { PetEngine, type PerformResult } from './engine'
export { simulate } from './simulation'
export { applyAction } from './actions'
export { deriveMood, lifeStageForAge } from './mood'
export { randomPersonality, describePersonality, nudgePersonality } from './personality'
export { makeEvent, type Names } from './events'
export { isRequestType, isRequestValid, REQUEST_ACTION } from './requests'
export * as dialogue from './dialogue'
export { RETURN_AFTER_MS, THRESHOLDS } from './tuning'

/** A freshly hatched pet: healthy, content, a little hungry for attention. */
export function newPetState(now: number): PetState {
  return {
    hunger: 80,
    happiness: 75,
    energy: 90,
    health: 100,
    cleanliness: 100,
    affection: 40,
    age: 0,
    sleeping: false,
    lastUpdated: now,
    lastInteraction: now
  }
}
