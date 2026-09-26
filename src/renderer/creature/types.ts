import type { LifeStage, Mood } from '../../types/pet'

/**
 * Creature artwork is pure data: palette + layered pixel grids.
 * To reskin the pet, create another `CreatureArt` (or replace the sprite
 * component entirely) – nothing else in the app depends on how it's drawn.
 *
 * Grid rows are strings; each character is a palette key, '.' is transparent.
 */
export interface PixelLayer {
  x: number
  y: number
  rows: readonly string[]
  /** Flip horizontally (used for the right eye). */
  mirror?: boolean
}

export const EYE_KINDS = [
  'open',
  'blink',
  'happy',
  'closed',
  'sad',
  'angry',
  'sleepy',
  'star',
  'heart',
  'surprised',
  'look',
  'dizzy'
] as const
export type EyeKind = (typeof EYE_KINDS)[number]

export const MOUTH_KINDS = ['smile', 'cat', 'open', 'o', 'chew', 'frown', 'flat', 'wavy', 'dot', 'grit'] as const
export type MouthKind = (typeof MOUTH_KINDS)[number]

/** How lively the back layer (e.g. wings) moves. */
export type Motion = 'rest' | 'fast' | 'still'

export interface CreatureArt {
  name: string
  width: number
  height: number
  palette: Readonly<Record<string, string>>
  body: readonly string[]
  /** Accessory that shows how grown-up the pet is. */
  stages: Readonly<Record<LifeStage, PixelLayer | null>>
  /** Eye grids are drawn for the left eye and mirrored for the right. */
  eyes: { left: { x: number; y: number }; right: { x: number; y: number }; kinds: Readonly<Record<EyeKind, readonly string[]>> }
  mouth: { x: number; y: number; kinds: Readonly<Record<MouthKind, readonly string[]>> }
  cheeks: readonly PixelLayer[]
  /** Smudges shown progressively as the pet gets dirtier. */
  dirt: readonly (readonly PixelLayer[])[]
  /** Drawn behind the body and animated on its own (e.g. flapping wings). */
  back?: readonly PixelLayer[]
  /** CSS filters that colour the body for certain moods (e.g. sickly green). */
  tints?: Readonly<Partial<Record<Mood, string>>>
  /**
   * Per-mood colour swaps. Better than `tints` for pale creatures, because
   * outlines and eyes stay crisp while only the chosen colours change.
   */
  moodPalettes?: Readonly<Partial<Record<Mood, Readonly<Record<string, string>>>>>
}
