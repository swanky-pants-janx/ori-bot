import type { PetEvent, PetEventType } from '../types/events'
import { describeDuration } from '../utils/time'

export interface Names {
  pet: string
  owner: string
}

type EventData = NonNullable<PetEvent['data']>

const describe: Record<PetEventType, (n: Names, d: EventData) => string> = {
  PET_BORN: (n) => `${n.pet} was born.`,
  PET_FED: (n) => `${n.owner} fed ${n.pet}.`,
  PET_PETTED: (n) => `${n.owner} petted ${n.pet}.`,
  PET_PLAYED: (n) => `${n.owner} played with ${n.pet}.`,
  PET_CLEANED: (n) => `${n.owner} gave ${n.pet} a bath.`,
  PET_SHAKEN: (n, d) =>
    d.woke
      ? `${n.owner} shook ${n.pet} awake.`
      : `${n.owner} shook ${n.pet} around${d.enjoyed ? `, and ${n.pet} loved it` : ` until ${n.pet} was dizzy`}.`,
  PET_SLEPT: (n, d) => (d.auto ? `${n.pet} got tired and fell asleep.` : `${n.owner} put ${n.pet} to bed.`),
  PET_WOKE: (n, d) => (d.auto ? `${n.pet} woke up feeling rested.` : `${n.owner} woke ${n.pet} up.`),
  PET_IGNORED: (n, d) => `${n.pet} has been left alone for ${describeDuration(Number(d.ms ?? 0))}.`,
  PET_HUNGRY: (n) => `${n.pet} is getting hungry.`,
  PET_TIRED: (n) => `${n.pet} is getting tired.`,
  PET_DIRTY: (n) => `${n.pet} is getting dirty.`,
  PET_SICK: (n) => `${n.pet} is feeling sick.`,
  PET_RECOVERED: (n) => `${n.pet} is feeling better.`,
  PET_HAPPY: (n) => `${n.pet} is feeling really happy.`,
  PET_SAD: (n) => `${n.pet} is feeling sad.`,
  PET_GREW_UP: (n, d) => `${n.pet} grew up and is now a ${String(d.stage)}.`,
  ACTION_REFUSED: (n, d) => `${n.pet} refused to ${String(d.action)} (${String(d.reason)}).`,
  USER_RETURNED: (n, d) => `${n.owner} has returned after being away for ${describeDuration(Number(d.ms ?? 0))}.`,
  USER_AWAY: (n) => `${n.owner} stepped away from the computer.`
}

export function makeEvent(type: PetEventType, timestamp: number, names: Names, data: EventData = {}): PetEvent {
  const event: PetEvent = { type, timestamp, message: describe[type](names, data) }
  if (Object.keys(data).length > 0) event.data = data
  return event
}
