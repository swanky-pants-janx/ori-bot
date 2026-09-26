import type { Mood } from '../../types/pet'

/** Friendly names for moods, shared by the stats panel and the mood cheat. */
export const MOOD_LABEL: Readonly<Record<Mood, string>> = {
  idle: 'Content',
  happy: 'Happy',
  excited: 'Excited',
  sad: 'Sad',
  hungry: 'Hungry',
  sleepy: 'Sleepy',
  angry: 'Grumpy',
  sick: 'Sick',
  dizzy: 'Dizzy',
  eating: 'Eating',
  playing: 'Playing',
  sleeping: 'Asleep'
}
