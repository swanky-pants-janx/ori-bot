import type { PetEvent } from '../types/events'
import type { PetState, Personality } from '../types/pet'
import { DAY, HOUR, MINUTE } from '../utils/time'
import { makeEvent, type Names } from './events'
import { lifeStageForAge } from './mood'
import { applyNeeds } from './needs'
import { applyTraitDelta } from './personality'
import { AUTO_SLEEP, MAX_SIMULATION_MS, PERSONALITY, THRESHOLDS } from './tuning'

export interface SimulationResult {
  state: PetState
  personality: Personality
  events: PetEvent[]
}

const BASE_STEP_MS = MINUTE
/** Upper bound on loop iterations for very long gaps. */
const MAX_STEPS = 20_000

/**
 * Advance the pet from `state.lastUpdated` to `to` using real elapsed time.
 * Used both for the live tick and for catching up after the app was closed,
 * so the pet behaves the same whether or not anyone is watching.
 */
export function simulate(
  state: PetState,
  personality: Personality,
  to: number,
  names: Names
): SimulationResult {
  const events: PetEvent[] = []

  // Clock moved backwards (e.g. manual time change): just re-anchor.
  if (to <= state.lastUpdated) {
    return { state: { ...state, lastUpdated: Math.min(state.lastUpdated, to) }, personality, events }
  }

  let from = state.lastUpdated
  if (to - from > MAX_SIMULATION_MS) from = to - MAX_SIMULATION_MS
  const total = to - from
  const stepMs = Math.max(BASE_STEP_MS, Math.ceil(total / MAX_STEPS))

  let s: PetState = { ...state, lastUpdated: from }
  let p = personality
  let t = from

  while (t < to) {
    const dt = Math.min(stepMs, to - t)
    const next = t + dt
    const before = s
    s = applyNeeds(s, p, dt / HOUR, next)

    // Being ignored for a long time slowly erodes the bond.
    if (next - s.lastInteraction > PERSONALITY.neglectAfterHours * HOUR) {
      p = applyTraitDelta(p, PERSONALITY.neglectPerDay, dt / DAY)
    }

    // The pet looks after its own sleep.
    if (!s.sleeping && s.energy < AUTO_SLEEP.fallAsleepBelow) {
      s = { ...s, sleeping: true }
      events.push(makeEvent('PET_SLEPT', next, names, { auto: true }))
    } else if (s.sleeping && s.energy >= AUTO_SLEEP.wakeAtOrAbove) {
      s = { ...s, sleeping: false }
      events.push(makeEvent('PET_WOKE', next, names, { auto: true }))
    }

    events.push(...thresholdEvents(before, s, next, names))
    t = next
  }

  return { state: { ...s, lastUpdated: to }, personality: p, events }
}

function crossedBelow(before: number, after: number, threshold: number): boolean {
  return before >= threshold && after < threshold
}

function crossedAbove(before: number, after: number, threshold: number): boolean {
  return before < threshold && after >= threshold
}

export function thresholdEvents(before: PetState, after: PetState, at: number, names: Names): PetEvent[] {
  const events: PetEvent[] = []
  if (crossedBelow(before.hunger, after.hunger, THRESHOLDS.hungry)) events.push(makeEvent('PET_HUNGRY', at, names))
  if (!after.sleeping && crossedBelow(before.energy, after.energy, THRESHOLDS.tired)) {
    events.push(makeEvent('PET_TIRED', at, names))
  }
  if (crossedBelow(before.cleanliness, after.cleanliness, THRESHOLDS.dirty)) {
    events.push(makeEvent('PET_DIRTY', at, names))
  }
  if (crossedBelow(before.health, after.health, THRESHOLDS.sick)) events.push(makeEvent('PET_SICK', at, names))
  if (crossedAbove(before.health, after.health, THRESHOLDS.recovered)) {
    events.push(makeEvent('PET_RECOVERED', at, names))
  }
  if (crossedAbove(before.happiness, after.happiness, THRESHOLDS.happy)) {
    events.push(makeEvent('PET_HAPPY', at, names))
  }
  if (crossedBelow(before.happiness, after.happiness, THRESHOLDS.sad)) events.push(makeEvent('PET_SAD', at, names))

  const stageBefore = lifeStageForAge(before.age)
  const stageAfter = lifeStageForAge(after.age)
  if (stageBefore !== stageAfter) events.push(makeEvent('PET_GREW_UP', at, names, { stage: stageAfter }))

  const aloneBefore = Math.floor((before.lastUpdated - before.lastInteraction) / DAY)
  const aloneAfter = Math.floor((at - after.lastInteraction) / DAY)
  if (aloneAfter >= 1 && aloneAfter > aloneBefore) {
    events.push(makeEvent('PET_IGNORED', at, names, { ms: at - after.lastInteraction }))
  }
  return events
}
