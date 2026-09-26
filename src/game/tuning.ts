/**
 * Every balance number in the game lives here so it can be tuned in one place.
 * Rates are "points per real-world hour" on the 0–100 stat scale.
 */

export const DECAY = {
  awake: {
    hunger: 4,
    energy: 4,
    cleanliness: 3,
    happiness: 1.5,
    affection: 0.2
  },
  asleep: {
    hunger: 1.5,
    energy: -20, // negative decay = recovery
    cleanliness: 1,
    happiness: 0,
    affection: 0
  },
  /** Extra affection loss per hour once the user hasn't interacted for a while. */
  neglectedAffection: 0.8,
  neglectAfterHours: 8
} as const

/** Knock-on effects when needs are unmet (per hour). */
export const CONSEQUENCES = {
  hungryBelow: 20,
  hungryHappiness: 3,
  starvingBelow: 8,
  starvingHealth: 3,

  dirtyBelow: 20,
  dirtyHappiness: 1.5,
  filthyBelow: 8,
  filthyHealth: 1.5,

  exhaustedBelow: 8,
  exhaustedHappiness: 2,
  exhaustedHealth: 1,

  miserableBelow: 12,
  miserableHealth: 0.5,

  /** Health slowly recovers when basic needs are met. */
  recoverWhen: { hunger: 45, cleanliness: 35, energy: 20 },
  recoverHealth: 4
} as const

export const AUTO_SLEEP = {
  /** Falls asleep on its own below this energy. */
  fallAsleepBelow: 10,
  /** Wakes up on its own once rested. */
  wakeAtOrAbove: 100
} as const

/** Stat thresholds used for mood + threshold-crossing events. */
export const THRESHOLDS = {
  hungry: 20,
  tired: 20,
  dirty: 20,
  sad: 25,
  sick: 25,
  recovered: 45,
  happy: 85
} as const

export const ACTIONS = {
  feed: { hunger: 20, happiness: 2, cleanliness: -2, fullAt: 95, activityMs: 3500 },
  pet: {
    affection: 5,
    happiness: 3,
    sleepingAffection: 2,
    activityMs: 2200,
    /** Petting many times in a short window has diminishing returns, then annoys. */
    spamWindowMs: 20_000,
    spamSoftLimit: 4,
    spamHardLimit: 9,
    annoyedMs: 6000
  },
  play: {
    happiness: 15,
    energy: -10,
    affection: 2,
    hunger: -3,
    minEnergy: 15,
    minHealth: 25,
    minHunger: 8,
    activityMs: 4200
  },
  sleep: { notTiredAbove: 90 },
  wake: { grumpyBelowEnergy: 50, grumpyHappiness: -4, annoyedMs: 5000 },
  clean: { cleanliness: 30, happiness: 2, alreadyCleanAbove: 95, activityMs: 3000 }
} as const

/** Being shaken while dragged around. */
export const SHAKE = {
  dizzyMs: 4000,
  /** Pets that don't enjoy it stay grumpy for a moment after the dizziness. */
  grumpyAfterMs: 3000,
  /** Playfulness at or above this makes shaking fun instead of upsetting. */
  enjoyPlayfulness: 60,
  funHappiness: 2,
  upsetHappiness: -4,
  energy: -2
} as const

/** Personality drift: tiny nudges, rate-limited per action type. */
export const PERSONALITY = {
  nudgeCooldownMs: 15 * 60 * 1000,
  /** Per day of being ignored (no interaction), applied during simulation. */
  neglectPerDay: { affection: -0.6, friendliness: -0.3 },
  neglectAfterHours: 24
} as const

/** Life stage by age in days. */
export const LIFE_STAGES = [
  { stage: 'baby', minDays: 0 },
  { stage: 'child', minDays: 2 },
  { stage: 'teen', minDays: 7 },
  { stage: 'adult', minDays: 21 }
] as const

export const REQUESTS = {
  durationMs: 3 * 60 * 1000,
  fulfilledHappiness: 3
} as const

/** How long the mood cheat holds short-lived moods (eating, playing, grumpy). */
export const CHEAT_HOLD_MS = 20_000

/** When the app has been closed / user idle longer than this, it counts as "returning". */
export const RETURN_AFTER_MS = 20 * 60 * 1000

/** Longest offline gap we bother simulating in detail. */
export const MAX_SIMULATION_MS = 60 * 24 * 60 * 60 * 1000
