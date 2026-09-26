import type { AppCategory } from '../types/api'
import type { PetEventType } from '../types/events'
import type { Mood, PetActionType, PetRequestType, RefusalReason } from '../types/pet'
import { pick, type Rng } from '../utils/math'

/**
 * Ori's own voice: a playful, broken mix of Afrikaans and English, for when
 * there's no AI brain (and for quick reactions that don't need one).
 *
 * Placeholders: {owner} = the user's name, {name} = the pet's name,
 * {species} = what the pet is (follows the chosen look, e.g. "bunny moth").
 */
export interface Speaker {
  owner: string
  name: string
  species: string
}

type Lines = readonly string[]

const ACTION_LINES: Record<PetActionType, Lines> = {
  feed: ['Nom nom nom, lekker!', 'Yummy!', '*munch munch*', 'Baie dankie vir die kos!', 'Lekker kos! Nog?', 'Mmm, so yummy!'],
  pet: ['Hehe~', '♥', 'Hehe, dit kielie!', '*happy wiggle*', 'Meer please!', 'Ek is lief vir jou!'],
  play: ['Whooo!!', 'Nog een keer! Nog een keer!', 'Vang!', 'Wow, dit is so cool!', 'Hehe, got it!', 'Weeee!'],
  sleep: ['Lekker slaap...', '*gaap* Nag nag', 'Zzz...', 'Slaap lekker, {owner}'],
  wake: ['*gaap*', 'Nou al môre?', 'Goeie môre, {owner}!', '*strek*'],
  clean: ['Borrels! Whooo!', 'Ek is so skoon en blink!', 'Splish splash!', 'Bad tyd is lekker!']
}

const REFUSAL_LINES: Record<RefusalReason, Lines> = {
  asleep: ['Zzz...', '*snork*', 'Mmmh... nog vyf minute...'],
  awake: ['Ek is al wakker, silly!'],
  full: ['Ek is vol! Ek gaan bars!', 'Nie dankie nie, ek is vol', 'Te vol vir nog...'],
  tired: ['Te moeg om te speel...', '*gaap* Miskien later?'],
  not_tired: ['Maar ek is nie moeg nie!', 'Slaaptyd? Nee man!'],
  sick: ['Ek voel nie lekker genoeg om te speel nie...', 'My tummy is seer...'],
  starving: ['Te honger om te speel!', 'Kos eers, asseblief?'],
  grumpy: ['Hmph!', 'Nie nou nie!', 'Nee man, genoeg!', 'Los my uit...'],
  already_clean: ['Ek is al klaar blink!', 'Maar ek het nou net gebad!']
}

/** Short reactions to how the pet feels (state changes, cheats, offline chat). */
const MOOD_LINES: Partial<Record<Mood, Lines>> = {
  hungry: ['My maag grom...', 'Is dit snack tyd?', 'Ek is honger, {owner}...', 'Kos? Asseblief?'],
  sleepy: ['*gaap*', 'Ek is so moeg...', 'Oë... gaan... toe...'],
  sad: ['*snik*', 'Hou jy nog van my?', 'Ek voel bietjie hartseer...', 'Waar is Moosie? :('],
  sick: ['Ek voel nie lekker nie...', '*hoes hoes*', 'Alles draai...'],
  excited: ['Whooo!!', 'Kom ons speel!', 'Party tyd!!', '*dans rond*', "Ek dans, ek dans, ek chat jou op, jy's opgechat!"],
  happy: ['La la la~', 'Ek hou van hier.', 'Jy is die beste', 'Wow, dit is so cool'],
  idle: ['Hmm...', '*kyk rond*', 'Wat doen jy, {owner}?', '*hum*'],
  dizzy: ['Alles draai...', 'Oe, ek is so duiselig...', '@_@'],
  angry: ['Hmph!', 'Los my uit!', 'Nee man!']
}

/**
 * Spontaneous chatter. Excited and happy pets have a lot to say; these are
 * Ori's typical phrases, so they come up again and again (on purpose).
 */
const CHATTER_LINES: Partial<Record<Mood, Lines>> = {
  excited: [
    'Whooo!!',
    'Ek is {name}!',
    'Wow, dit is so cool',
    'Ek hou van party',
    'Party tyd!!',
    '*dans rond*',
    'Ek is SO happy vandag!',
    'Kom ons speel!',
    'Lekker lekker lekker!',
    'Weeee!',
    'Jy is die beste, {owner}!',
    'Kyk na my! Kyk!',
    "Vandag is 'n baie goeie day!",
    'Yay yay yay!'
  ],
  happy: [
    'La la la~',
    'Ek is {name}!',
    'Wow, dit is so cool',
    'Ek hou van party',
    'Ek hou van hier.',
    'Jy is so cool, {owner}',
    'Lekker, man!',
    "*hum 'n liedjie*",
    'Ek is lief vir jou!',
    'Wat doen jy, {owner}?'
  ],
  idle: ['Hmm...', '*kyk rond*', 'Wat werk jy, {owner}?', '*hum*', 'Ek is {name}.', 'Is dit al party tyd?'],
  hungry: MOOD_LINES.hungry ?? [],
  sleepy: MOOD_LINES.sleepy ?? [],
  sad: MOOD_LINES.sad ?? [],
  sick: MOOD_LINES.sick ?? [],
  sleeping: ['Zzz... party... zzz', '*snork*', 'Mmm... lekker kos...', 'Zzz... {species}... zzz', '*mompel mompel*']
}

const RETURN_LINES: Lines = ["Jy's terug!", 'Ek het jou gemis, {owner}!', 'Yay, {owner}!', 'Welkom terug!']
const LONG_RETURN_LINES: Lines = ['Waar was jy?! Ek het jou SO gemis!', '{owner}! Jy was vir ewig weg!']
const GREW_UP_LINES: Lines = ['Ek voel so groot!', 'Kyk, ek het gegroei!']
const HELLO_LINES: Lines = ["Haai! Ek is {name}! Click my vir 'n pat, of hover vir goed om te doen!"]
const REQUEST_LINES: Record<PetRequestType, Lines> = {
  REQUEST_FOOD: ["Kan ek 'n snack kry?"],
  REQUEST_PLAY: ['Wil jy speel?'],
  REQUEST_SLEEP: ["Kan ek 'n slapie vat?"],
  REQUEST_PET: ['Pat my, please?'],
  REQUEST_CLEAN: ["Ek het 'n bad nodig..."]
}

const EVENT_MOOD: Partial<Record<PetEventType, Mood>> = {
  PET_HUNGRY: 'hungry',
  PET_TIRED: 'sleepy',
  PET_SICK: 'sick',
  PET_SAD: 'sad',
  PET_HAPPY: 'excited'
}

const EVENT_LINES: Partial<Record<PetEventType, Lines>> = {
  PET_DIRTY: ['Ek voel so vuil...', 'Is dit ek wat so stink?', 'Bad tyd, miskien?'],
  PET_RECOVERED: ['Ek voel beter!', 'Alles reg! Dankie!'],
  PET_WOKE: ['*gaap* Goeie môre!', '*strek* Ek het so lekker geslaap!'],
  PET_SLEPT: ['So... moeg... zzz']
}

const SHAKE_LINES = {
  enjoyed: ['Wheee! Nog een keer!', 'Whooo!! Dit is so cool!', 'Hehe, vinniger!', 'Weeee!'],
  upset: ['Eina! Sit my neer!', 'Nee man, stop dit!', 'Alles draai!', 'Hey! Nie so rof nie!'],
  woke: ['Hè?! Ek het geslaap!', 'Wat?! Hoekom maak jy my so wakker?']
} as const

const ROAM_LINES = {
  follow: ['Wag vir my!', 'Waarheen gaan ons?', 'Ek kom saam!', '*volg jou*'],
  wander: ['Kyk hoe vlieg ek!', 'Zoom!', 'Whooo!!', 'Ek gaan explore!'],
  chase: ['Ek kry dit!', 'Myne! Myne!', 'Wag, wag!', 'Bal! Bal!'],
  perch: ['Lekker uitsig van hier!', 'Ek sit hier bo!', '*sit op die venster*', 'Wow, dit is so cool hier bo'],
  fall: ['Waaah!', 'Hè?!', 'Eeeek!'],
  land: ['Oef!', 'Oeps!', '*plof*', 'Ek is okay!']
} as const

/** Reactions to the app the user switches to (app awareness). */
const APP_LINES: Partial<Record<AppCategory, Lines>> = {
  code: ['Jy code weer! Wow, dit is so cool', 'Tik tik tik... jy is so slim!', "Maak jy 'n app vir my?", 'Ek hou van code!'],
  music: ['Musiek! *dans*', 'Ek hou van party!', 'Whooo!! Speel iets lekker!', '*wiggle wiggle*'],
  call: ['*fluister* Ek sal stil wees...', "*sjjj* Jy is op 'n call"],
  video: ['Ooh, fliek tyd!', 'Kan ek saam kyk?'],
  browse: ['Wat lees jy?', 'Ooh, die internet!'],
  chat: ['Wie praat jy mee?', 'Sê hallo van my!'],
  design: ['Mooi kleure!', 'Wow, dit is so cool'],
  write: ['Wat skryf jy?', 'Skryf iets oor my!'],
  game: ['Kan ek ook speel?', 'Whooo!! Game tyd!']
}

export function appLine(category: AppCategory, s: Speaker, rng: Rng = Math.random): string | null {
  const lines = APP_LINES[category]
  return lines ? say(lines, s, rng) : null
}

const CHEAT_LINES = {
  younger: ['Hè? Alles is so groot!', 'Ek voel weer tiny!'],
  full: ['Ek voel fantasties!', 'Beste dag ooit!', 'Wow, ek voel brand new!'],
  skip: ['Waar het die tyd gegaan?', 'Het ek iets gemis?', '*knip oë* Hoe lank was dit?']
} as const

function fill(line: string, s: Speaker): string {
  return line
    .replaceAll('{owner}', s.owner || 'vriend')
    .replaceAll('{name}', s.name)
    .replaceAll('{species}', s.species)
}

function say(lines: Lines, s: Speaker, rng: Rng): string {
  return fill(pick(lines, rng), s)
}

export const actionLine = (action: PetActionType, s: Speaker, rng: Rng = Math.random): string =>
  say(ACTION_LINES[action], s, rng)

export const refusalLine = (reason: RefusalReason, s: Speaker, rng: Rng = Math.random): string =>
  say(REFUSAL_LINES[reason], s, rng)

export function moodLine(mood: Mood, s: Speaker, rng: Rng = Math.random): string | null {
  const lines = MOOD_LINES[mood]
  return lines ? say(lines, s, rng) : null
}

/** Something to say unprompted. `avoid` lets the caller skip lines it just said. */
export function chatterLine(mood: Mood, s: Speaker, rng: Rng = Math.random, avoid: readonly string[] = []): string | null {
  const lines = CHATTER_LINES[mood]
  if (!lines || lines.length === 0) return null
  for (let i = 0; i < 6; i++) {
    const line = say(lines, s, rng)
    if (!avoid.includes(line)) return line
  }
  return say(lines, s, rng)
}

export const returnLine = (awayMs: number, s: Speaker, rng: Rng = Math.random): string =>
  say(awayMs > 12 * 60 * 60 * 1000 ? LONG_RETURN_LINES : RETURN_LINES, s, rng)

export const grewUpLine = (s: Speaker, rng: Rng = Math.random): string => say(GREW_UP_LINES, s, rng)
export const helloLine = (s: Speaker, rng: Rng = Math.random): string => say(HELLO_LINES, s, rng)
export const requestLine = (type: PetRequestType, s: Speaker, rng: Rng = Math.random): string =>
  say(REQUEST_LINES[type], s, rng)
export const shakeLine = (kind: keyof typeof SHAKE_LINES, s: Speaker, rng: Rng = Math.random): string =>
  say(SHAKE_LINES[kind], s, rng)
export const roamLine = (kind: keyof typeof ROAM_LINES, s: Speaker, rng: Rng = Math.random): string =>
  say(ROAM_LINES[kind], s, rng)
export const cheatLine = (key: keyof typeof CHEAT_LINES, s: Speaker, rng: Rng = Math.random): string =>
  say(CHEAT_LINES[key], s, rng)

/** A spontaneous reaction to something that just happened, if there is one. */
export function eventLine(type: PetEventType, s: Speaker, rng: Rng = Math.random): string | null {
  if (type === 'PET_GREW_UP') return grewUpLine(s, rng)
  const mood = EVENT_MOOD[type]
  if (mood) return moodLine(mood, s, rng)
  const lines = EVENT_LINES[type]
  return lines ? say(lines, s, rng) : null
}
