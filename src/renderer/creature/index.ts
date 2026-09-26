import type { CreatureId } from '../../types/settings'
import { moth } from './moth'
import { ori } from './ori'
import type { CreatureArt } from './types'

/** Every look the pet can have. Add an entry here (and to CREATURE_IDS) to add a skin. */
export const CREATURES: Readonly<Record<CreatureId, CreatureArt>> = { ori, moth }

export const CREATURE_INFO: Readonly<Record<CreatureId, { label: string; blurb: string }>> = {
  ori: { label: 'Ori', blurb: 'Mint blob with a sprout' },
  moth: { label: 'Moth', blurb: 'Fluffy cream moth with wings' }
}

/** Pixel scale that makes any creature roughly the size of the original 31×30 Ori. */
export function sizeFactor(art: CreatureArt): number {
  return Math.min(31 / art.width, 30 / art.height)
}
