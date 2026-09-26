import type { PetActionType, PetRequestType, PetState } from '../types/pet'

export const REQUEST_TYPES: readonly PetRequestType[] = [
  'REQUEST_FOOD',
  'REQUEST_PLAY',
  'REQUEST_SLEEP',
  'REQUEST_PET',
  'REQUEST_CLEAN'
]

export const REQUEST_ACTION: Record<PetRequestType, PetActionType> = {
  REQUEST_FOOD: 'feed',
  REQUEST_PLAY: 'play',
  REQUEST_SLEEP: 'sleep',
  REQUEST_PET: 'pet',
  REQUEST_CLEAN: 'clean'
}

export function isRequestType(value: unknown): value is PetRequestType {
  return typeof value === 'string' && (REQUEST_TYPES as readonly string[]).includes(value)
}

/**
 * The AI can ask for things, but only requests that make sense for the pet's
 * real state are accepted. A full pet can't beg for food.
 */
export function isRequestValid(type: PetRequestType, s: PetState): boolean {
  if (s.sleeping) return false
  switch (type) {
    case 'REQUEST_FOOD':
      return s.hunger < 70
    case 'REQUEST_PLAY':
      return s.energy >= 15 && s.health >= 25
    case 'REQUEST_SLEEP':
      return s.energy < 60
    case 'REQUEST_PET':
      return true
    case 'REQUEST_CLEAN':
      return s.cleanliness < 70
  }
}
