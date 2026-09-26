import type { ActivityType, PetActionType, PetState, Personality, RefusalReason } from '../types/pet'
import { clamp, type Rng } from '../utils/math'
import { ACTIONS } from './tuning'

export interface ActionContext {
  now: number
  rng: Rng
  /** Timestamps of recent pets, used to detect over-petting. */
  recentPets: readonly number[]
}

export interface ActionOutcome {
  ok: boolean
  reason?: RefusalReason
  /** State after the action (may change even when refused, e.g. getting annoyed). */
  state: PetState
  activity?: { type: ActivityType; ms: number }
  annoyedMs?: number
}

/** 0.7x at trait 0, 1.0x at 50, 1.3x at 100. */
function traitScale(trait: number): number {
  return 0.7 + trait / 166
}

function refuse(state: PetState, reason: RefusalReason, now: number): ActionOutcome {
  return { ok: false, reason, state: { ...state, lastInteraction: now } }
}

type StatChanges = Partial<Pick<PetState, 'hunger' | 'happiness' | 'energy' | 'health' | 'cleanliness' | 'affection'>>

function change(state: PetState, delta: StatChanges, now: number): PetState {
  const next: PetState = { ...state, lastInteraction: now }
  for (const [key, d] of Object.entries(delta) as [keyof StatChanges, number][]) {
    next[key] = clamp(next[key] + d)
  }
  return next
}

/**
 * The rules for every care action. The engine is authoritative:
 * the UI and AI can only *ask* for an action, this decides what happens.
 */
export function applyAction(
  action: PetActionType,
  state: PetState,
  personality: Personality,
  ctx: ActionContext
): ActionOutcome {
  const { now } = ctx
  switch (action) {
    case 'feed': {
      const a = ACTIONS.feed
      if (state.sleeping) return refuse(state, 'asleep', now)
      if (state.hunger >= a.fullAt) return refuse(state, 'full', now)
      return {
        ok: true,
        state: change(state, { hunger: a.hunger, happiness: a.happiness, cleanliness: a.cleanliness }, now),
        activity: { type: 'eating', ms: a.activityMs }
      }
    }

    case 'pet': {
      const a = ACTIONS.pet
      if (state.sleeping) {
        return {
          ok: true,
          state: change(state, { affection: a.sleepingAffection }, now),
          activity: { type: 'petted', ms: a.activityMs }
        }
      }
      const count = ctx.recentPets.filter((t) => now - t < a.spamWindowMs).length + 1
      const hardLimit = a.spamHardLimit - Math.round(personality.stubbornness / 25)
      if (count > hardLimit) {
        return {
          ok: false,
          reason: 'grumpy',
          state: change(state, { happiness: -2 }, now),
          annoyedMs: a.annoyedMs
        }
      }
      const scale = count <= a.spamSoftLimit ? 1 : Math.max(0.2, 1 - (count - a.spamSoftLimit) * 0.2)
      return {
        ok: true,
        state: change(
          state,
          { affection: a.affection * scale * traitScale(personality.affection), happiness: a.happiness * scale },
          now
        ),
        activity: { type: 'petted', ms: a.activityMs }
      }
    }

    case 'play': {
      const a = ACTIONS.play
      if (state.sleeping) return refuse(state, 'asleep', now)
      if (state.health < a.minHealth) return refuse(state, 'sick', now)
      if (state.hunger < a.minHunger) return refuse(state, 'starving', now)
      if (state.energy < a.minEnergy) return refuse(state, 'tired', now)
      // A grumpy, stubborn pet sometimes just won't.
      const sulkChance = (personality.stubbornness - 50) / 100
      if (state.happiness < 30 && sulkChance > 0 && ctx.rng() < sulkChance) return refuse(state, 'grumpy', now)
      return {
        ok: true,
        state: change(
          state,
          {
            happiness: a.happiness * traitScale(personality.playfulness),
            energy: a.energy,
            affection: a.affection,
            hunger: a.hunger
          },
          now
        ),
        activity: { type: 'playing', ms: a.activityMs }
      }
    }

    case 'sleep': {
      if (state.sleeping) return refuse(state, 'asleep', now)
      if (state.energy > ACTIONS.sleep.notTiredAbove) return refuse(state, 'not_tired', now)
      return { ok: true, state: { ...state, sleeping: true, lastInteraction: now } }
    }

    case 'wake': {
      const a = ACTIONS.wake
      if (!state.sleeping) return refuse(state, 'awake', now)
      const woken: PetState = { ...state, sleeping: false, lastInteraction: now }
      if (state.energy < a.grumpyBelowEnergy) {
        return { ok: true, state: change(woken, { happiness: a.grumpyHappiness }, now), annoyedMs: a.annoyedMs }
      }
      return { ok: true, state: woken }
    }

    case 'clean': {
      const a = ACTIONS.clean
      if (state.sleeping) return refuse(state, 'asleep', now)
      if (state.cleanliness > a.alreadyCleanAbove) return refuse(state, 'already_clean', now)
      return {
        ok: true,
        state: change(state, { cleanliness: a.cleanliness, happiness: a.happiness }, now),
        activity: { type: 'bathing', ms: a.activityMs }
      }
    }
  }
}
