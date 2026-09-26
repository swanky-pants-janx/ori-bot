import type { Database, StoredPet } from '../database'
import { dialogue, makeEvent, newPetState, PetEngine, randomPersonality } from '../game'
import type { AppCategory, DesktopActivity } from '../types/api'
import type { Emotion, Speech } from '../types/chat'
import type { PetEvent } from '../types/events'
import {
  LIFE_STAGE_IDS,
  type ActionResult,
  type Cheat,
  type Mood,
  type PetActionType,
  type PetRequestType,
  type PetSnapshot
} from '../types/pet'
import { CREATURE_SPECIES } from '../types/settings'
import type { Rng } from '../utils/math'
import { DAY, MINUTE } from '../utils/time'
import type { SettingsService } from './settingsService'

const TICK_MS = 2000
const SAVE_EVERY_MS = 30_000
/**
 * How talkative the pet is, by mood: a minimum quiet gap after it last spoke,
 * then an average extra wait. Excited and happy pets chatter away, sometimes
 * rattling off a few lines in a row (`burst` = chance of a burst).
 */
const CHATTER: Partial<Record<Mood, { gapMs: number; meanMs: number; burst?: number }>> = {
  excited: { gapMs: 20_000, meanMs: 25_000, burst: 0.35 },
  happy: { gapMs: 50_000, meanMs: 60_000, burst: 0.15 },
  idle: { gapMs: 4 * MINUTE, meanMs: 6 * MINUTE },
  hungry: { gapMs: 5 * MINUTE, meanMs: 8 * MINUTE },
  sleepy: { gapMs: 5 * MINUTE, meanMs: 8 * MINUTE },
  sad: { gapMs: 6 * MINUTE, meanMs: 8 * MINUTE },
  sick: { gapMs: 6 * MINUTE, meanMs: 8 * MINUTE },
  sleeping: { gapMs: 4 * MINUTE, meanMs: 6 * MINUTE } // sleep-talk
}
const BURST_STEP_MS = 3200
/** Don't chatter over a conversation. */
const QUIET_AFTER_CHAT_MS = 90_000

const MILESTONES: Partial<Record<PetEvent['type'], { importance: number; text: (e: PetEvent) => string }>> = {
  PET_BORN: { importance: 60, text: (e) => `I was born on ${new Date(e.timestamp).toDateString()}` },
  PET_GREW_UP: {
    importance: 65,
    text: (e) => `I grew up into a ${String(e.data?.stage)} on ${new Date(e.timestamp).toDateString()}`
  },
  PET_SICK: { importance: 40, text: (e) => `I got sick on ${new Date(e.timestamp).toDateString()}` }
}

type Listener<T> = (value: T) => void

/**
 * Runs the living pet: owns the engine, advances real time, persists state,
 * records events and decides when the pet speaks up on its own.
 */
export class PetService {
  private engine!: PetEngine
  private timer: ReturnType<typeof setInterval> | null = null
  private lastSaved = 0
  private lastPushedKey = ''
  private lastSpeechAt = 0
  private lastChatAt = 0
  private recentLines: string[] = []
  private burstTimers: ReturnType<typeof setTimeout>[] = []
  /** What the user is doing (app awareness), for reactions and the AI. */
  private activity: { current: DesktopActivity; description: string } | null = null
  private readonly lastAppLine = new Map<AppCategory, number>()
  private speechId = 0
  private readonly snapshotListeners = new Set<Listener<PetSnapshot>>()
  private readonly speechListeners = new Set<Listener<Speech>>()

  constructor(
    private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly clock: () => number = Date.now,
    private readonly rng: Rng = Math.random
  ) {
    settings.onChange((s) => {
      if (this.engine && this.engine.ownerName !== s.ownerName) this.engine.ownerName = s.ownerName
    })
  }

  get petId(): number {
    return this.engine.info.id
  }

  /** Load (or hatch) the pet and catch up on the time that passed while the app was closed. */
  init(): { awayMs: number; hatched: boolean } {
    const now = this.clock()
    const existing = this.db.pets.load()
    const stored = existing ?? this.hatch('Ori', now)
    this.engine = new PetEngine(stored.info, stored.state, stored.personality, {
      ownerName: this.settings.get().ownerName,
      rng: this.rng
    })
    const awayMs = Math.max(0, now - stored.state.lastUpdated)
    this.record(this.engine.advance(now), false)
    this.save(now)
    this.db.events.prune(now - 30 * DAY)
    return { awayMs, hatched: existing === null }
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.cancelBurst()
    this.save(this.clock())
  }

  snapshot(): PetSnapshot {
    return this.engine.snapshot(this.clock())
  }

  act(action: PetActionType): ActionResult {
    const now = this.clock()
    const result = this.engine.perform(action, now)
    this.record(result.events, false)
    this.save(now)

    const who = this.speaker()
    let speech: string | undefined
    if (result.ok) {
      // Petting is frequent – let the hearts do most of the talking.
      if (action !== 'pet' || this.rng() < 0.35) speech = dialogue.actionLine(action, who, this.rng)
    } else if (result.reason) {
      speech = dialogue.refusalLine(result.reason, who, this.rng)
    }
    if (speech) this.say(speech, 'script', result.reason === 'grumpy' ? 'angry' : null)

    this.push(now, true)
    return { ok: result.ok, action, reason: result.reason, speech, snapshot: this.engine.snapshot(now) }
  }

  /** Apply a cheat, save, and let the pet react to its new situation. */
  cheat(cheat: Cheat): PetSnapshot {
    const now = this.clock()
    const before = this.engine.snapshot(now)
    const events = this.engine.cheat(cheat, now)
    this.record(events, false)
    this.save(now)
    const after = this.engine.snapshot(now)
    const who = this.speaker()

    let line: string | null = null
    if (cheat.kind === 'grow' && before.lifeStage !== after.lifeStage) {
      const older = LIFE_STAGE_IDS.indexOf(after.lifeStage) > LIFE_STAGE_IDS.indexOf(before.lifeStage)
      line = older ? dialogue.grewUpLine(who, this.rng) : dialogue.cheatLine('younger', who, this.rng)
    } else if (cheat.kind === 'needs') {
      line = cheat.preset === 'full' ? dialogue.cheatLine('full', who, this.rng) : dialogue.eventLine('PET_DIRTY', who, this.rng)
    } else if (cheat.kind === 'mood') {
      line =
        after.mood === 'eating'
          ? dialogue.actionLine('feed', who, this.rng)
          : after.mood === 'playing'
            ? dialogue.actionLine('play', who, this.rng)
            : after.mood === 'angry'
              ? dialogue.refusalLine('grumpy', who, this.rng)
              : dialogue.moodLine(after.mood, who, this.rng)
    } else if (cheat.kind === 'skip' && !after.state.sleeping) {
      const notable = [...events].reverse().find((e) => dialogue.eventLine(e.type, who, this.rng) !== null)
      line = notable ? dialogue.eventLine(notable.type, who, this.rng) : dialogue.cheatLine('skip', who, this.rng)
    }
    // No emotion for mood cheats: the face should show exactly the chosen mood.
    if (line) this.say(line, 'script', cheat.kind === 'grow' ? 'excited' : null)

    this.push(now, true)
    return after
  }

  /** Can the pet do this right now? If not, it says why (and nothing changes). */
  check(action: PetActionType): { ok: boolean; reason?: string } {
    const result = this.engine.check(action, this.clock())
    if (!result.ok && result.reason) {
      this.say(dialogue.refusalLine(result.reason, this.speaker(), this.rng), 'script')
    }
    return result
  }

  /** Shaken while being dragged. Rate-limited upstream by the shake detector. */
  shake(): void {
    const now = this.clock()
    const result = this.engine.shake(now)
    this.record(result.events, false)
    this.save(now)
    if (now - this.lastSpeechAt > 1500) {
      const kind = result.woke ? 'woke' : result.enjoyed ? 'enjoyed' : 'upset'
      this.say(dialogue.shakeLine(kind, this.speaker(), this.rng), 'script')
    }
    this.push(now, true)
  }

  /** The AI asked for something. Returns whether the engine accepted it. */
  requestFromAI(type: PetRequestType): boolean {
    const now = this.clock()
    const accepted = this.engine.raiseRequest(type, now)
    if (accepted) this.push(now, true)
    return accepted
  }

  noteChat(): void {
    const now = this.clock()
    this.lastChatAt = now
    this.cancelBurst()
    this.engine.recordChat(now)
    this.save(now)
  }

  /** The user came back (app launched after a while, or returned from being idle). */
  userReturned(awayMs: number): PetEvent {
    const event = makeEvent('USER_RETURNED', this.clock(), this.engine.names, { ms: awayMs })
    this.record([event], false)
    return event
  }

  userAway(): void {
    this.record([makeEvent('USER_AWAY', this.clock(), this.engine.names)], false)
  }

  recentEvents(limit: number, sinceMs: number): PetEvent[] {
    return this.db.events.recent(this.petId, limit, this.clock() - sinceMs)
  }

  rename(name: string): PetSnapshot {
    const clean = name.trim().slice(0, 24)
    if (clean) {
      this.engine.rename(clean)
      this.db.pets.rename(this.petId, clean)
    }
    this.push(this.clock(), true)
    return this.snapshot()
  }

  /** Say goodbye to the current pet and hatch a new one. Irreversible. */
  adoptNew(name: string): PetSnapshot {
    const now = this.clock()
    this.db.pets.delete(this.petId)
    const stored = this.hatch(name.trim().slice(0, 24) || 'Ori', now)
    this.engine = new PetEngine(stored.info, stored.state, stored.personality, {
      ownerName: this.settings.get().ownerName,
      rng: this.rng
    })
    this.save(now)
    this.say(dialogue.helloLine(this.speaker(), this.rng), 'script', 'excited')
    this.push(now, true)
    return this.snapshot()
  }

  /** Who's talking and to whom – fills in names in the pet's lines. */
  speaker(): dialogue.Speaker {
    const s = this.settings.get()
    return { owner: s.ownerName, name: this.engine.info.name, species: CREATURE_SPECIES[s.creature] }
  }

  /** A little remark while moving about the desktop (called by the roamer). */
  roamRemark(kind: 'wander' | 'follow' | 'chase' | 'perch' | 'fall' | 'land'): void {
    if (this.settings.get().chatty && !this.quiet) this.say(dialogue.roamLine(kind, this.speaker(), this.rng), 'script')
  }

  /** On a call: no unprompted chatter. */
  get quiet(): boolean {
    return this.activity?.current.category === 'call'
  }

  /** What the user is doing, e.g. "coding in VS Code" – null when app awareness is off. */
  activityDescription(): string | null {
    return this.activity?.description ?? null
  }

  /** App awareness noticed the user switched apps. React now and then. */
  setActivity(activity: DesktopActivity | null, description = ''): void {
    const previous = this.activity?.current.category
    this.activity = activity ? { current: activity, description } : null
    if (!activity || activity.category === previous) return
    if (!this.settings.get().chatty && activity.category !== 'call') return
    const now = this.clock()
    if (now - (this.lastAppLine.get(activity.category) ?? -Infinity) < 10 * MINUTE) return
    if (this.engine.snapshot(now).state.sleeping) return
    const line = dialogue.appLine(activity.category, this.speaker(), this.rng)
    if (!line) return
    this.lastAppLine.set(activity.category, now)
    this.say(line, 'script')
  }

  say(text: string, source: Speech['source'], emotion: Emotion | null = null): void {
    this.lastSpeechAt = this.clock()
    this.recentLines = [text, ...this.recentLines].slice(0, 8)
    const speech: Speech = { id: ++this.speechId, text, emotion, source }
    for (const l of this.speechListeners) l(speech)
  }

  onSnapshot(listener: Listener<PetSnapshot>): () => void {
    this.snapshotListeners.add(listener)
    return () => this.snapshotListeners.delete(listener)
  }

  onSpeech(listener: Listener<Speech>): () => void {
    this.speechListeners.add(listener)
    return () => this.speechListeners.delete(listener)
  }

  private tick(): void {
    const now = this.clock()
    this.record(this.engine.advance(now), true)
    if (now - this.lastSaved > SAVE_EVERY_MS) this.save(now)
    this.push(now)
    this.maybeChatter(now)
  }

  private hatch(name: string, now: number): StoredPet {
    const stored = this.db.pets.create(
      { name, species: 'blob', createdAt: now, birthday: now },
      newPetState(now),
      randomPersonality(this.rng)
    )
    const born = makeEvent('PET_BORN', now, { pet: name, owner: this.settings.get().ownerName || 'my human' })
    this.db.events.add(stored.info.id, [born])
    this.rememberMilestone(stored.info.id, born)
    return stored
  }

  /** Persist events, turn milestones into memories and optionally react out loud. */
  private record(events: PetEvent[], speak: boolean): void {
    if (events.length === 0) return
    this.db.events.add(this.petId, events)
    for (const e of events) this.rememberMilestone(this.petId, e)

    if (!speak || !this.settings.get().chatty) return
    const now = this.clock()
    // React to the most notable thing that just happened, not every event.
    for (const e of [...events].reverse()) {
      const line = dialogue.eventLine(e.type, this.speaker(), this.rng)
      if (line && (e.type === 'PET_GREW_UP' || now - this.lastSpeechAt > 2 * MINUTE)) {
        this.say(line, 'script')
        break
      }
    }
  }

  private rememberMilestone(petId: number, e: PetEvent): void {
    const m = MILESTONES[e.type]
    if (!m) return
    this.db.memories.add(petId, { timestamp: e.timestamp, type: 'milestone', content: m.text(e), importance: m.importance })
  }

  private maybeChatter(now: number): void {
    const snap = this.engine.snapshot(now)
    const pace = CHATTER[snap.mood]
    if (!pace || !this.settings.get().chatty || snap.activity || this.quiet) return
    if (now - this.lastChatAt < QUIET_AFTER_CHAT_MS || this.burstTimers.length > 0) return
    if (now - this.lastSpeechAt < pace.gapMs) return
    if (this.rng() > TICK_MS / pace.meanMs) return

    const mood = snap.mood
    const line = dialogue.chatterLine(mood, this.speaker(), this.rng, this.recentLines)
    if (!line) return
    this.say(line, 'script')

    // Sometimes an excited pet just keeps going.
    if (pace.burst && this.rng() < pace.burst) {
      const extra = 1 + Math.floor(this.rng() * 2)
      for (let i = 1; i <= extra; i++) {
        const timer = setTimeout(() => {
          this.burstTimers = this.burstTimers.filter((t) => t !== timer)
          if (this.engine.snapshot(this.clock()).mood !== mood) return
          const next = dialogue.chatterLine(mood, this.speaker(), this.rng, this.recentLines)
          if (next) this.say(next, 'script')
        }, i * BURST_STEP_MS)
        this.burstTimers.push(timer)
      }
    }
  }

  private cancelBurst(): void {
    for (const t of this.burstTimers) clearTimeout(t)
    this.burstTimers = []
  }

  private save(now: number): void {
    this.db.pets.saveState(this.petId, this.engine.state)
    this.db.pets.savePersonality(this.petId, this.engine.personality, now)
    this.lastSaved = now
  }

  /** Send a snapshot to listeners when something visible changed (or when forced). */
  private push(now: number, force = false): void {
    const snap = this.engine.snapshot(now)
    const st = snap.state
    const key = [
      snap.info.name,
      snap.mood,
      snap.lifeStage,
      snap.activity?.type,
      snap.request?.type,
      snap.annoyed,
      st.sleeping,
      Math.round(st.hunger),
      Math.round(st.happiness),
      Math.round(st.energy),
      Math.round(st.health),
      Math.round(st.cleanliness),
      Math.round(st.affection),
      Math.floor(st.age)
    ].join('|')
    if (!force && key === this.lastPushedKey) return
    this.lastPushedKey = key
    for (const l of this.snapshotListeners) l(snap)
  }
}
