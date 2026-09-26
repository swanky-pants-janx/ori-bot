<script lang="ts">
  import type { LifeStage, Mood } from '../../types/pet'
  import type { Expression } from './expressions'
  import PixelSprite from './PixelSprite.svelte'
  import type { CreatureArt, Motion, PixelLayer } from './types'

  interface Props {
    art: CreatureArt
    expression: Expression
    lifeStage: LifeStage
    cleanliness: number
    /** Eye offset in pixels (-1, 0 or 1) so the pet can look around. */
    look: { x: number; y: number }
    scale: number
    motion?: Motion
    mood?: Mood
  }

  let { art, expression, lifeStage, cleanliness, look, scale, motion = 'rest', mood }: Props = $props()

  const palette = $derived(mood && art.moodPalettes?.[mood] ? { ...art.palette, ...art.moodPalettes[mood] } : art.palette)

  const layers = $derived.by(() => {
    const out: PixelLayer[] = [{ x: 0, y: 0, rows: art.body }]
    const stage = art.stages[lifeStage]
    if (stage) out.push(stage)
    const dirtLevel = cleanliness < 25 ? 2 : cleanliness < 45 ? 1 : 0
    for (let i = 0; i < dirtLevel; i++) out.push(...(art.dirt[i] ?? []))
    if (expression.blush) out.push(...art.cheeks)

    const eyes = art.eyes.kinds[expression.eyes]
    out.push({ x: art.eyes.left.x + look.x, y: art.eyes.left.y + look.y, rows: eyes })
    out.push({ x: art.eyes.right.x + look.x, y: art.eyes.right.y + look.y, rows: eyes, mirror: true })
    out.push({ x: art.mouth.x, y: art.mouth.y, rows: art.mouth.kinds[expression.mouth] })
    return out
  })
</script>

<div class="creature">
  {#if art.back}
    <div class="back {motion}">
      <PixelSprite width={art.width} height={art.height} layers={art.back} {palette} {scale} />
    </div>
  {/if}
  <div class="front">
    <PixelSprite width={art.width} height={art.height} {layers} {palette} {scale} label={art.name} />
  </div>
</div>

<style>
  .creature {
    position: relative;
  }

  .front {
    position: relative;
  }

  .back {
    position: absolute;
    inset: 0;
    transform-origin: 50% 70%;
    animation: flap 1.8s ease-in-out infinite;
  }

  .back.fast {
    animation-duration: 0.34s;
  }

  .back.still {
    animation: none;
    transform: scale(0.88, 0.97);
  }

  /* Seen from the front, a wingbeat is the wings narrowing towards the body. */
  @keyframes flap {
    0%,
    100% {
      transform: scale(1, 1);
    }
    50% {
      transform: scale(0.84, 1.03);
    }
  }
</style>
