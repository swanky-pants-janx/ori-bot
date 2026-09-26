import type { PetEvent, PetEventType } from '../types/events'
import type {
  Activity,
  Cheat,
  PetActionType,
  PetInfo,
  PetRequest,
  PetRequestType,
  PetSnapshot,
  PetState,
  Personality,
  RefusalReason
} from '../types/pet'
import { clamp, type Rng } from '../utils/math'
import { HOUR } from '../utils/time'
import { applyAction } from './actions'
import { ageForStage, applyMoodCheat, applyNeedsPreset } from './cheats'
import { makeEvent, type Names } from './events'
import { deriveMood, lifeStageForAge } from './mood'
import { nudgePersonality, type NudgeKind } from './personality'
import { isRequestValid, REQUEST_ACTION } from './requests'
import { simulate, thresholdEvents } from './simulation'
import { ACTIONS, CHEAT_HOLD_MS, PERSONALITY, REQUESTS, SHAKE } from './tuning'

export interface PerformResult {
  ok: boolean
  reason?: RefusalReason
  events: PetEvent[]
}

const ACTION_EVENT: Record<PetActionType, PetEventType> = {
  feed: 'PET_FED',
  pet: 'PET_PETTED',
  play: 'PET_PLAYED',
  sleep: 'PET_SLEPT',
  wake: 'PET_WOKE',
  clean: 'PET_CLEANED'
}

/**
 * The authoritative pet simulation. Pure game logic – no timers, storage or UI.
 * Callers pass in `now` so the engine is deterministic and easy to test.
 */
export class PetEngine {
  info: PetInfo
  state: PetState
  personality: Personality
  ownerName: string

  private activity: Activity | null = null
  private annoyedUntil = 0
  private dizzyUntil = 0
  private request: PetRequest | null = null
  private recentPets: number[] = []
  private readonly lastNudge = new Map<NudgeKind, number>()
  private readonly rng: Rng

  constructor(info: PetInfo, state: PetState, personality: Personality, opts: { rng?: Rng; ownerName?: string } = {}) {
    this.info = info
    this.state = state
    this.personality = personality
    this.rng = opts.rng ?? Math.random
    this.ownerName = opts.ownerName ?? ''
  }

  get names(): Names {
    return { pet: this.info.name, owner: this.ownerName || 'my human' }
  }

  /** Advance real time up to `now`. Returns anything noteworthy that happened. */
  advance(now: number): PetEvent[] {
    const result = simulate(this.state, this.personality, now, this.names)
    this.state = result.state
    this.personality = result.personality
    if (this.activity && this.activity.until <= now) this.activity = null
    if (this.request && (this.request.until <= now || !isRequestValid(this.request.type, this.state))) {
      this.request = null
    }
    return result.events
  }

  perform(action: PetActionType, now: number): PerformResult {
    const events = this.advance(now)
    const before = this.state
    const outcome = applyAction(action, this.state, this.personality, {
      now,
      rng: this.rng,
      recentPets: this.recentPets
    })
    this.state = outcome.state

    if (action === 'pet') {
      this.recentPets = [...this.recentPets.filter((t) => now - t < ACTIONS.pet.spamWindowMs), now]
    }
    if (outcome.activity) this.activity = { type: outcome.activity.type, until: now + outcome.activity.ms }
    else if (outcome.ok && action === 'sleep') this.activity = null
    if (outcome.annoyedMs) this.annoyedUntil = now + outcome.annoyedMs

    if (outcome.ok) {
      events.push(makeEvent(ACTION_EVENT[action], now, this.names))
      this.nudge(action, now)
      if (this.request?.action === action) {
        this.state = { ...this.state, happiness: clamp(this.state.happiness + REQUESTS.fulfilledHappiness) }
        this.request = null
      }
    } else {
      events.push(makeEvent('ACTION_REFUSED', now, this.names, { action, reason: outcome.reason ?? 'unknown' }))
    }

    events.push(...thresholdEvents(before, this.state, now, this.names))
    return { ok: outcome.ok, reason: outcome.reason, events }
  }

  /**
   * Would this action work right now? A dry run – nothing changes. Used before
   * handing the user an apple, sponge or ball so they don't do it for nothing.
   */
  check(action: PetActionType, now: number): { ok: boolean; reason?: RefusalReason } {
    this.advance(now)
    const outcome = applyAction(action, this.state, this.personality, {
      now,
      rng: () => 1, // never the random "sulk" refusal in a dry run
      recentPets: this.recentPets
    })
    return { ok: outcome.ok, reason: outcome.reason }
  }

  /** The pet (via its AI brain) asks for something. Only sensible requests are accepted. */
  raiseRequest(type: PetRequestType, now: number): boolean {
    this.advance(now)
    if (!isRequestValid(type, this.state)) return false
    this.request = { type, action: REQUEST_ACTION[type], until: now + REQUESTS.durationMs }
    return true
  }

  /**
   * Cheats still go through the engine. Skipping time replays real
   * simulation (as if nobody was around), so it emits the usual events.
   */
  cheat(cheat: Cheat, now: number): PetEvent[] {
    const events = this.advance(now)
    switch (cheat.kind) {
      case 'grow':
        this.state = { ...this.state, age: ageForStage(cheat.stage) }
        break
      case 'needs':
        this.state = applyNeedsPreset(this.state, cheat.preset)
        this.activity = null
        this.annoyedUntil = 0
        break
      case 'mood': {
        const result = applyMoodCheat(this.state, cheat.mood)
        this.state = result.state
        this.activity = result.activity ? { type: result.activity, until: now + CHEAT_HOLD_MS } : null
        this.annoyedUntil = result.annoyed ? now + CHEAT_HOLD_MS : 0
        this.dizzyUntil = result.dizzy ? now + CHEAT_HOLD_MS : 0
        this.request = null
        break
      }
      case 'skip': {
        const ms = cheat.hours * HOUR
        this.state = {
          ...this.state,
          lastUpdated: this.state.lastUpdated - ms,
          lastInteraction: this.state.lastInteraction - ms
        }
        events.push(...this.advance(now))
        break
      }
    }
    return events
  }

  /**
   * Shaken while being dragged around. Leaves the pet dizzy; playful pets
   * think it's a ride, everyone else gets upset (and a little grumpy after).
   */
  shake(now: number): { events: PetEvent[]; enjoyed: boolean; woke: boolean } {
    const events = this.advance(now)
    const before = this.state
    const woke = before.sleeping
    const enjoyed = !woke && this.personality.playfulness >= SHAKE.enjoyPlayfulness && before.health >= 25
    this.state = {
      ...before,
      sleeping: false,
      happiness: clamp(before.happiness + (enjoyed ? SHAKE.funHappiness : SHAKE.upsetHappiness)),
      energy: clamp(before.energy + SHAKE.energy),
      lastInteraction: now
    }
    this.activity = null
    this.dizzyUntil = now + SHAKE.dizzyMs
    if (!enjoyed) this.annoyedUntil = this.dizzyUntil + SHAKE.grumpyAfterMs
    events.push(makeEvent('PET_SHAKEN', now, this.names, { enjoyed, woke }))
    this.nudge('shake', now)
    events.push(...thresholdEvents(before, this.state, now, this.names))
    return { events, enjoyed, woke }
  }

  /** Talking to the pet counts as attention and slowly shapes it. */
  recordChat(now: number): void {
    this.advance(now)
    this.state = { ...this.state, lastInteraction: now }
    this.nudge('chat', now)
  }

  rename(name: string): void {
    this.info = { ...this.info, name }
  }

  snapshot(now: number): PetSnapshot {
    const activity = this.activity && this.activity.until > now ? this.activity : null
    const annoyed = this.annoyedUntil > now
    const dizzy = this.dizzyUntil > now
    const request = this.request && this.request.until > now ? this.request : null
    return {
      info: this.info,
      state: this.state,
      personality: this.personality,
      mood: deriveMood({ state: this.state, personality: this.personality, activity, annoyed, dizzy }),
      lifeStage: lifeStageForAge(this.state.age),
      activity,
      request,
      annoyed,
      now
    }
  }

  /** Personality drifts slowly: each kind of interaction counts at most once per cooldown. */
  private nudge(kind: NudgeKind, now: number): void {
    const last = this.lastNudge.get(kind)
    if (last !== undefined && now - last < PERSONALITY.nudgeCooldownMs) return
    this.lastNudge.set(kind, now)
    this.personality = nudgePersonality(this.personality, kind)
  }
}
