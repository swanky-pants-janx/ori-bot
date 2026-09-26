export const PET_EVENT_TYPES = [
  'PET_BORN',
  'PET_FED',
  'PET_PETTED',
  'PET_PLAYED',
  'PET_CLEANED',
  'PET_SHAKEN',
  'PET_SLEPT',
  'PET_WOKE',
  'PET_IGNORED',
  'PET_HUNGRY',
  'PET_TIRED',
  'PET_DIRTY',
  'PET_SICK',
  'PET_RECOVERED',
  'PET_HAPPY',
  'PET_SAD',
  'PET_GREW_UP',
  'ACTION_REFUSED',
  'USER_RETURNED',
  'USER_AWAY'
] as const

export type PetEventType = (typeof PET_EVENT_TYPES)[number]

export interface PetEvent {
  type: PetEventType
  timestamp: number
  /** Human-readable description, suitable for handing to the AI as context. */
  message: string
  data?: Record<string, string | number | boolean>
}
