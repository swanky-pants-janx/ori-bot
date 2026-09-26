import { describe, expect, it } from 'vitest'
import { MOOD_IDS, type PetInfo, type PetState, type Personality } from '../types/pet'
import { DAY, HOUR, MINUTE } from '../utils/time'
import { applyAction } from './actions'
import { PetEngine } from './engine'
import { newPetState } from './index'
import { deriveMood, lifeStageForAge } from './mood'
import { describePersonality } from './personality'
import { simulate } from './simulation'

const T0 = Date.UTC(2026, 0, 1, 12)
const names = { pet: 'Ori', owner: 'Janx' }
const neutral: Personality = {
  friendliness: 50,
  playfulness: 50,
  curiosity: 50,
  stubbornness: 50,
  affection: 50,
  energy: 50
}
const info: PetInfo = { id: 1, name: 'Ori', species: 'blob', createdAt: T0, birthday: T0 }

function state(overrides: Partial<PetState> = {}): PetState {
  return { ...newPetState(T0), ...overrides }
}

describe('offline time progression', () => {
  it('applies needs decay for real elapsed time', () => {
    const start = state({ hunger: 100, energy: 100, cleanliness: 100 })
    const { state: after } = simulate(start, neutral, T0 + 8 * HOUR, names)
    expect(after.hunger).toBeCloseTo(100 - 4 * 8, 0)
    expect(after.cleanliness).toBeCloseTo(100 - 3 * 8, 0)
    expect(after.energy).toBeLessThan(100)
    expect(after.age).toBeCloseTo(8 / 24, 3)
    expect(after.lastUpdated).toBe(T0 + 8 * HOUR)
  })

  it('gives the same result whether simulated in one go or in small ticks', () => {
    const start = state()
    const once = simulate(start, neutral, T0 + 6 * HOUR, names).state
    let ticked = start
    for (let t = T0 + 10_000; t <= T0 + 6 * HOUR; t += 10_000) ticked = simulate(ticked, neutral, t, names).state
    expect(ticked.hunger).toBeCloseTo(once.hunger, 1)
    expect(ticked.energy).toBeCloseTo(once.energy, 1)
    expect(ticked.happiness).toBeCloseTo(once.happiness, 1)
  })

  it('falls asleep on its own when exhausted and wakes up rested', () => {
    const start = state({ energy: 12, hunger: 100 })
    const { state: asleep, events } = simulate(start, neutral, T0 + 1 * HOUR, names)
    expect(asleep.sleeping).toBe(true)
    expect(events.some((e) => e.type === 'PET_SLEPT')).toBe(true)

    const { state: rested, events: later } = simulate(asleep, neutral, asleep.lastUpdated + 6 * HOUR, names)
    expect(rested.sleeping).toBe(false)
    expect(later.some((e) => e.type === 'PET_WOKE')).toBe(true)
  })

  it('loses health when starving and emits hunger/sick events', () => {
    const start = state({ hunger: 22, health: 30 })
    const { state: after, events } = simulate(start, neutral, T0 + 12 * HOUR, names)
    expect(after.health).toBeLessThan(30)
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['PET_HUNGRY', 'PET_SICK']))
  })

  it('recovers health when needs are met', () => {
    const start = state({ health: 40, hunger: 100, cleanliness: 100, energy: 100 })
    const { state: after } = simulate(start, neutral, T0 + 2 * HOUR, names)
    expect(after.health).toBeGreaterThan(40)
  })

  it('never lets stats leave 0–100', () => {
    const { state: after } = simulate(state(), neutral, T0 + 30 * DAY, names)
    for (const key of ['hunger', 'happiness', 'energy', 'health', 'cleanliness', 'affection'] as const) {
      expect(after[key]).toBeGreaterThanOrEqual(0)
      expect(after[key]).toBeLessThanOrEqual(100)
    }
  })

  it('reports being ignored and lets personality drift when neglected', () => {
    const { personality, events } = simulate(state(), neutral, T0 + 3 * DAY, names)
    expect(events.some((e) => e.type === 'PET_IGNORED')).toBe(true)
    expect(personality.affection).toBeLessThan(neutral.affection)
    expect(personality.affection).toBeGreaterThan(neutral.affection - 3) // subtle
  })

  it('handles the clock going backwards without changing stats', () => {
    const start = state({ lastUpdated: T0 + HOUR })
    const { state: after } = simulate(start, neutral, T0, names)
    expect(after.hunger).toBe(start.hunger)
    expect(after.lastUpdated).toBe(T0)
  })

  it('simulates very long gaps quickly', () => {
    const t = performance.now()
    simulate(state(), neutral, T0 + 365 * DAY, names)
    expect(performance.now() - t).toBeLessThan(500)
  })
})

describe('actions', () => {
  const ctx = { now: T0 + MINUTE, rng: () => 0.99, recentPets: [] }

  it('feeding fills hunger, refuses when full or asleep', () => {
    const fed = applyAction('feed', state({ hunger: 50 }), neutral, ctx)
    expect(fed.ok).toBe(true)
    expect(fed.state.hunger).toBe(70)
    expect(fed.activity?.type).toBe('eating')
    expect(applyAction('feed', state({ hunger: 97 }), neutral, ctx)).toMatchObject({ ok: false, reason: 'full' })
    expect(applyAction('feed', state({ sleeping: true }), neutral, ctx)).toMatchObject({ ok: false, reason: 'asleep' })
  })

  it('playing costs energy and needs enough of it', () => {
    const played = applyAction('play', state({ energy: 60, happiness: 50 }), neutral, ctx)
    expect(played.ok).toBe(true)
    expect(played.state.energy).toBe(50)
    expect(played.state.happiness).toBeGreaterThan(60)
    expect(applyAction('play', state({ energy: 10 }), neutral, ctx)).toMatchObject({ ok: false, reason: 'tired' })
    expect(applyAction('play', state({ health: 10 }), neutral, ctx)).toMatchObject({ ok: false, reason: 'sick' })
  })

  it('petting has diminishing returns and eventually annoys', () => {
    const engine = new PetEngine(info, state({ happiness: 50, affection: 20 }), neutral)
    let now = T0
    const results = []
    for (let i = 0; i < 12; i++) {
      now += 1000
      results.push(engine.perform('pet', now))
    }
    expect(results[0].ok).toBe(true)
    expect(results.some((r) => r.reason === 'grumpy')).toBe(true)
    expect(engine.snapshot(now).mood).toBe('angry')
  })

  it('sleep and wake toggle sleeping; waking a tired pet makes it grumpy', () => {
    const engine = new PetEngine(info, state({ energy: 30 }), neutral)
    expect(engine.perform('sleep', T0).ok).toBe(true)
    expect(engine.snapshot(T0).mood).toBe('sleeping')
    expect(engine.perform('sleep', T0 + 1000).reason).toBe('asleep')
    expect(engine.perform('wake', T0 + 2000).ok).toBe(true)
    expect(engine.snapshot(T0 + 2000).annoyed).toBe(true)
  })

  it('cleaning raises cleanliness', () => {
    const cleaned = applyAction('clean', state({ cleanliness: 40 }), neutral, ctx)
    expect(cleaned.state.cleanliness).toBe(70)
    expect(applyAction('clean', state({ cleanliness: 99 }), neutral, ctx).reason).toBe('already_clean')
  })
})

describe('engine', () => {
  it('emits events for actions and refusals', () => {
    const engine = new PetEngine(info, state({ hunger: 50 }), neutral, { ownerName: 'Janx' })
    const fed = engine.perform('feed', T0 + 1000)
    expect(fed.events.find((e) => e.type === 'PET_FED')?.message).toBe('Janx fed Ori.')
    const refused = engine.perform('wake', T0 + 2000)
    expect(refused.events.some((e) => e.type === 'ACTION_REFUSED')).toBe(true)
  })

  it('shows eating while the activity lasts, then returns to a normal mood', () => {
    const engine = new PetEngine(info, state({ hunger: 50 }), neutral)
    engine.perform('feed', T0)
    expect(engine.snapshot(T0 + 1000).mood).toBe('eating')
    engine.advance(T0 + 10_000)
    expect(engine.snapshot(T0 + 10_000).mood).not.toBe('eating')
  })

  it('only accepts AI requests that match the real state', () => {
    const full = new PetEngine(info, state({ hunger: 95 }), neutral)
    expect(full.raiseRequest('REQUEST_FOOD', T0)).toBe(false)
    const hungry = new PetEngine(info, state({ hunger: 30 }), neutral)
    expect(hungry.raiseRequest('REQUEST_FOOD', T0)).toBe(true)
    expect(hungry.snapshot(T0).request?.action).toBe('feed')
    hungry.perform('feed', T0 + 1000)
    expect(hungry.snapshot(T0 + 1000).request).toBeNull()
  })

  it('nudges personality subtly and at most once per cooldown', () => {
    const engine = new PetEngine(info, state({ energy: 100, happiness: 20 }), neutral)
    for (let i = 0; i < 5; i++) engine.perform('play', T0 + i * 5000)
    expect(engine.personality.playfulness).toBeCloseTo(50.25, 5)
  })
})

describe('dry-run checks', () => {
  it('reports refusals without changing anything', () => {
    const engine = new PetEngine(info, state({ hunger: 97 }), neutral)
    const before = { ...engine.state }
    expect(engine.check('feed', T0)).toEqual({ ok: false, reason: 'full' })
    expect(engine.check('play', T0).ok).toBe(true)
    expect(engine.state.hunger).toBe(before.hunger)
    expect(engine.state.happiness).toBe(before.happiness)
    expect(engine.snapshot(T0).activity).toBeNull()
  })
})

describe('shaking', () => {
  const playful = { ...neutral, playfulness: 85 }
  const calm = { ...neutral, playfulness: 20 }

  it('makes the pet dizzy for a few seconds and records the event', () => {
    const engine = new PetEngine(info, state(), calm, { ownerName: 'Janx' })
    const { events } = engine.shake(T0)
    expect(engine.snapshot(T0 + 1000).mood).toBe('dizzy')
    expect(events.find((e) => e.type === 'PET_SHAKEN')?.message).toBe('Janx shook Ori around until Ori was dizzy.')
    engine.advance(T0 + 10_000)
    expect(engine.snapshot(T0 + 10_000).mood).not.toBe('dizzy')
  })

  it('is fun for playful pets and upsetting (then grumpy) for others', () => {
    const fun = new PetEngine(info, state({ happiness: 50 }), playful)
    expect(fun.shake(T0).enjoyed).toBe(true)
    expect(fun.state.happiness).toBeGreaterThan(50)
    expect(fun.snapshot(T0 + 5000).mood).not.toBe('angry')

    const upset = new PetEngine(info, state({ happiness: 50 }), calm)
    expect(upset.shake(T0).enjoyed).toBe(false)
    expect(upset.state.happiness).toBeLessThan(50)
    expect(upset.snapshot(T0 + 5000).mood).toBe('angry') // after the dizziness wears off
  })

  it('wakes a sleeping pet (who is not amused)', () => {
    const engine = new PetEngine(info, state({ sleeping: true, energy: 50 }), playful)
    const result = engine.shake(T0)
    expect(result).toMatchObject({ woke: true, enjoyed: false })
    expect(engine.state.sleeping).toBe(false)
  })
})

describe('cheats', () => {
  it('grows the pet to any life stage (and back)', () => {
    const engine = new PetEngine(info, state(), neutral)
    engine.cheat({ kind: 'grow', stage: 'adult' }, T0)
    expect(engine.snapshot(T0).lifeStage).toBe('adult')
    engine.cheat({ kind: 'grow', stage: 'baby' }, T0)
    expect(engine.snapshot(T0).lifeStage).toBe('baby')
  })

  it('applies needs presets', () => {
    const engine = new PetEngine(info, state({ health: 20, hunger: 5 }), neutral)
    engine.cheat({ kind: 'needs', preset: 'full' }, T0)
    expect(engine.state).toMatchObject({ health: 100, hunger: 100, cleanliness: 100 })
    engine.cheat({ kind: 'needs', preset: 'dirty' }, T0)
    expect(engine.state.cleanliness).toBe(10)
  })

  // Worst-case start: starving, sick, filthy, asleep – every mood must still come out exactly.
  const awful = state({ hunger: 3, health: 5, energy: 3, happiness: 5, cleanliness: 2, sleeping: true })
  const extremes = [
    { ...neutral, playfulness: 0 },
    { ...neutral, playfulness: 100 }
  ]
  it.each(MOOD_IDS.flatMap((mood) => extremes.map((p) => [mood, p.playfulness, p] as const)))(
    'mood cheat → %s (playfulness %i)',
    (mood, _playfulness, personality) => {
      const engine = new PetEngine(info, awful, personality)
      engine.cheat({ kind: 'mood', mood }, T0)
      expect(engine.snapshot(T0 + 1000).mood).toBe(mood)
      // And it's real state: it survives the next tick of the simulation.
      engine.advance(T0 + 5000)
      expect(engine.snapshot(T0 + 5000).mood).toBe(mood)
    }
  )

  it('holds short-lived moods for a while, then lets them go', () => {
    const engine = new PetEngine(info, state(), neutral)
    engine.cheat({ kind: 'mood', mood: 'eating' }, T0)
    expect(engine.snapshot(T0 + 15_000).mood).toBe('eating')
    engine.advance(T0 + 25_000)
    expect(engine.snapshot(T0 + 25_000).mood).not.toBe('eating')
  })

  it('skipping time replays the real simulation, events included', () => {
    const engine = new PetEngine(info, state({ hunger: 30 }), neutral)
    const events = engine.cheat({ kind: 'skip', hours: 8 }, T0)
    expect(engine.state.hunger).toBeLessThan(10)
    expect(engine.state.age).toBeCloseTo(8 / 24, 2)
    expect(engine.state.lastUpdated).toBe(T0)
    expect(events.some((e) => e.type === 'PET_HUNGRY')).toBe(true)
  })
})

describe('mood', () => {
  const base = { personality: neutral, activity: null, annoyed: false, dizzy: false }
  it.each([
    [{ energy: 10 }, 'sleepy'],
    [{ hunger: 10 }, 'hungry'],
    [{ happiness: 10 }, 'sad'],
    [{ health: 10 }, 'sick'],
    [{ sleeping: true }, 'sleeping'],
    [{ happiness: 95, energy: 80 }, 'excited'],
    [{ happiness: 70 }, 'happy'],
    [{ happiness: 50 }, 'idle']
  ] as const)('%o → %s', (overrides, mood) => {
    expect(deriveMood({ ...base, state: state(overrides) })).toBe(mood)
  })

  it('maps age to life stages', () => {
    expect(lifeStageForAge(0.5)).toBe('baby')
    expect(lifeStageForAge(3)).toBe('child')
    expect(lifeStageForAge(10)).toBe('teen')
    expect(lifeStageForAge(30)).toBe('adult')
  })

  it('describes personality in words', () => {
    expect(describePersonality(neutral)).toBe('balanced and even-tempered')
    expect(describePersonality({ ...neutral, playfulness: 90 })).toContain('very playful')
  })
})
