<script lang="ts">
  import { onMount } from 'svelte'
  import PixelIcon from '../components/PixelIcon.svelte'
  import { ICONS } from '../creature/icons'
  import { api } from '../lib/api'

  /** The ball lives in its own window; the main process moves it. It just spins. */
  let angle = $state(0)
  let vanishing = $state(false)
  let held = $state(false)

  const RADIUS = 22

  onMount(() => {
    let lastX = window.screenX
    let raf = 0
    const spin = (): void => {
      const x = window.screenX
      angle += ((x - lastX) / RADIUS) * (180 / Math.PI)
      lastX = x
      raf = requestAnimationFrame(spin)
    }
    raf = requestAnimationFrame(spin)
    const off = api.toy.onVanish(() => (vanishing = true))
    return () => {
      cancelAnimationFrame(raf)
      off()
    }
  })

  function grab(e: PointerEvent): void {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    held = true
    api.toy.grab()
  }

  function release(): void {
    if (!held) return
    held = false
    api.toy.release()
  }
</script>

<div
  class="ball"
  class:held
  class:vanishing
  style="transform: rotate({angle}deg)"
  role="button"
  tabindex="-1"
  aria-label="Ball – grab it and throw"
  onpointerdown={grab}
  onpointerup={release}
  onpointercancel={release}
>
  <PixelIcon glyph={ICONS.play} scale={4} />
</div>

<style>
  .ball {
    display: grid;
    place-items: center;
    width: 100vw;
    height: 100vh;
    cursor: grab;
    filter: drop-shadow(0 2px 0 rgba(59, 45, 79, 0.25));
    transition: scale 0.1s;
  }

  .ball.held {
    cursor: grabbing;
    scale: 1.08;
  }

  .ball.vanishing {
    animation: vanish 0.28s ease-in forwards;
  }

  @keyframes vanish {
    to {
      opacity: 0;
      scale: 0.2;
    }
  }
</style>
