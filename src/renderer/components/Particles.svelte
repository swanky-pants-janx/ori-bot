<script lang="ts">
  import { EFFECTS } from '../creature/icons'
  import PixelIcon from './PixelIcon.svelte'

  type Kind = 'heart' | 'sparkle' | 'bubble' | 'crumb' | 'note'

  interface Particle {
    id: number
    kind: Kind
    x: number
    y: number
    dx: number
    delay: number
    dur: number
    scale: number
  }

  let particles = $state<Particle[]>([])
  let nextId = 0

  /** Emit a little burst of particles around the pet. */
  export function burst(kind: Kind, count: number, spread = 70): void {
    const born: Particle[] = []
    for (let i = 0; i < count; i++) {
      born.push({
        id: nextId++,
        kind,
        x: (Math.random() - 0.5) * spread,
        y: (Math.random() - 0.5) * 24,
        dx: (Math.random() - 0.5) * 50,
        delay: i * (kind === 'crumb' ? 60 : 110),
        dur: kind === 'crumb' ? 700 : 1100 + Math.random() * 600,
        scale: kind === 'crumb' ? 2 : 2 + Math.round(Math.random())
      })
    }
    particles = [...particles, ...born]
    const ids = new Set(born.map((p) => p.id))
    const life = Math.max(...born.map((p) => p.delay + p.dur)) + 50
    setTimeout(() => (particles = particles.filter((p) => !ids.has(p.id))), life)
  }
</script>

<div class="particles" aria-hidden="true">
  {#each particles as p (p.id)}
    <span
      class="particle {p.kind}"
      style="--x:{p.x}px; --y:{p.y}px; --dx:{p.dx}px; animation-delay:{p.delay}ms; animation-duration:{p.dur}ms"
    >
      <PixelIcon glyph={EFFECTS[p.kind]} scale={p.scale} />
    </span>
  {/each}
</div>

<style>
  .particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .particle {
    position: absolute;
    left: 50%;
    top: 40%;
    opacity: 0;
    transform: translate(calc(-50% + var(--x)), var(--y));
    animation-name: rise;
    animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
    animation-fill-mode: forwards;
  }

  .particle.crumb {
    top: 74%;
    animation-name: fall;
    animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.6);
  }

  .particle.bubble {
    top: 55%;
  }

  @keyframes rise {
    0% {
      opacity: 0;
      transform: translate(calc(-50% + var(--x)), var(--y)) scale(0.6);
    }
    15% {
      opacity: 1;
      transform: translate(calc(-50% + var(--x)), calc(var(--y) - 8px)) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(calc(-50% + var(--x) + var(--dx)), calc(var(--y) - 80px)) scale(0.9);
    }
  }

  @keyframes fall {
    0% {
      opacity: 1;
      transform: translate(calc(-50% + var(--x) * 0.4), 0);
    }
    100% {
      opacity: 0;
      transform: translate(calc(-50% + var(--x) * 0.4 + var(--dx) * 0.6), 44px);
    }
  }
</style>
