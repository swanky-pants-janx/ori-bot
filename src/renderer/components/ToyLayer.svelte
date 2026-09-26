<script lang="ts">
  import { onMount } from 'svelte'
  import { EFFECTS, ICONS } from '../creature/icons'
  import { app } from '../lib/state.svelte'
  import PixelIcon from './PixelIcon.svelte'

  interface Props {
    tool: 'apple' | 'sponge'
    petName: string
    /** Apple dropped on the pet. Resolves true if it was eaten. */
    onfeed: () => Promise<boolean>
    /** Scrubbed enough – bath time is done. */
    onwashed: () => void
    ondismiss: () => void
  }

  let { tool, petName, onfeed, onwashed, ondismiss }: Props = $props()

  /** Pixels of rubbing over the pet for a full wash. */
  const SCRUB_DISTANCE = 2400
  const IDLE_MS = 45_000

  let layer: HTMLDivElement | undefined = $state()
  let pos = $state({ x: -100, y: -100 })
  let meter = $state({ x: 0, y: 0 })
  let dragging = $state(false)
  let returning = $state(false)
  let touched = $state(false)
  let bubbles = $state<{ id: number; x: number; y: number }[]>([])

  let home = { x: 0, y: 0 }
  let grip = { x: 0, y: 0 }
  let last: { x: number; y: number } | null = null
  let sinceBubble = 0
  let bubbleId = 0
  let washed = false
  let scrubTimer: ReturnType<typeof setTimeout> | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  function creature(): DOMRect | null {
    return document.querySelector('.stage .creature')?.getBoundingClientRect() ?? null
  }

  function layerRect(): DOMRect {
    return layer?.getBoundingClientRect() ?? new DOMRect()
  }

  /** The tool's centre in window coordinates. */
  function toolClient(): { x: number; y: number } {
    const r = layerRect()
    return { x: r.left + pos.x, y: r.top + pos.y }
  }

  /** Only the pet's body counts – not the empty corners of its sprite. */
  function overPet(p: { x: number; y: number }): boolean {
    const c = creature()
    if (!c) return false
    return (
      p.x > c.left + c.width * 0.15 &&
      p.x < c.right - c.width * 0.15 &&
      p.y > c.top + c.height * 0.25 &&
      p.y < c.bottom - c.height * 0.05
    )
  }

  function nearMouth(p: { x: number; y: number }): boolean {
    const c = creature()
    if (!c) return false
    return Math.hypot(p.x - (c.left + c.width / 2), p.y - (c.top + c.height * 0.63)) < 70
  }

  function resetIdle(): void {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(ondismiss, IDLE_MS)
  }

  onMount(() => {
    const c = creature()
    const r = layerRect()
    if (c) {
      // Apple pops out on the left, sponge on the right.
      const x = tool === 'apple' ? c.left - 30 : c.right + 30
      home = { x: Math.min(Math.max(x - r.left, 24), r.width - 24), y: c.top + c.height * 0.55 - r.top }
      meter = { x: c.left + c.width / 2 - r.left, y: c.bottom + 4 - r.top }
    } else {
      home = { x: 40, y: r.height / 2 }
    }
    pos = { ...home }
    resetIdle()
    return () => {
      clearTimeout(idleTimer)
      clearTimeout(scrubTimer)
      app.anticipating = false
      app.scrubbing = false
    }
  })

  function down(e: PointerEvent): void {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const r = layerRect()
    grip = { x: e.clientX - r.left - pos.x, y: e.clientY - r.top - pos.y }
    last = { x: e.clientX, y: e.clientY }
    dragging = true
    returning = false
    touched = true
    resetIdle()
  }

  function move(e: PointerEvent): void {
    if (!dragging) return
    const r = layerRect()
    pos = { x: e.clientX - r.left - grip.x, y: e.clientY - r.top - grip.y }
    const at = toolClient()
    const moved = last ? Math.hypot(e.clientX - last.x, e.clientY - last.y) : 0
    last = { x: e.clientX, y: e.clientY }

    if (tool === 'apple') {
      app.anticipating = nearMouth(at)
      return
    }

    // Scrub-a-dub: rubbing over the pet fills the wash meter.
    if (moved > 0 && overPet(at) && !washed) {
      app.scrub = Math.min(1, app.scrub + moved / SCRUB_DISTANCE)
      app.scrubbing = true
      clearTimeout(scrubTimer)
      scrubTimer = setTimeout(() => (app.scrubbing = false), 250)
      sinceBubble += moved
      if (sinceBubble > 40) {
        sinceBubble = 0
        bubble()
      }
      if (app.scrub >= 1) {
        washed = true
        dragging = false
        onwashed()
      }
    }
  }

  async function up(): Promise<void> {
    if (!dragging) return
    dragging = false
    if (tool !== 'apple') return
    const at = toolClient()
    const onTarget = app.anticipating || overPet(at)
    app.anticipating = false
    if (onTarget && !(await onfeed())) goHome()
  }

  function goHome(): void {
    returning = true
    pos = { ...home }
  }

  function bubble(): void {
    const id = bubbleId++
    bubbles = [...bubbles, { id, x: pos.x + (Math.random() - 0.5) * 28, y: pos.y + (Math.random() - 0.5) * 18 }]
    setTimeout(() => (bubbles = bubbles.filter((b) => b.id !== id)), 900)
  }
</script>

<div class="layer" bind:this={layer}>
  {#each bubbles as b (b.id)}
    <span class="bubble" style="left: {b.x}px; top: {b.y}px" aria-hidden="true">
      <PixelIcon glyph={EFFECTS.bubble} scale={2} />
    </span>
  {/each}

  {#if tool === 'sponge' && app.scrub > 0}
    <div class="meter" style="left: {meter.x}px; top: {meter.y}px" aria-label="Washing progress">
      <span style="width: {Math.round(app.scrub * 100)}%"></span>
    </div>
  {/if}

  <div
    class="tool {tool}"
    class:dragging
    class:returning
    data-hit
    role="button"
    tabindex="0"
    aria-label={tool === 'apple' ? `Apple – drag it to ${petName}` : `Sponge – scrub ${petName}`}
    style="left: {pos.x}px; top: {pos.y}px"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  >
    <PixelIcon glyph={tool === 'apple' ? ICONS.feed : ICONS.sponge} scale={3} />
    {#if !touched}
      <span class="hint">{tool === 'apple' ? `Feed ${petName}!` : 'Scrub scrub!'}</span>
    {/if}
  </div>
</div>

<style>
  .layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
  }

  .tool {
    position: absolute;
    translate: -50% -50%;
    pointer-events: auto;
    cursor: grab;
    touch-action: none;
    filter: drop-shadow(0 2px 0 rgba(59, 45, 79, 0.3));
    animation: pop-in 0.35s cubic-bezier(0.3, 1.6, 0.5, 1);
  }

  .tool:not(.dragging) {
    animation:
      pop-in 0.35s cubic-bezier(0.3, 1.6, 0.5, 1),
      bob 1.6s ease-in-out 0.35s infinite;
  }

  .tool.dragging {
    cursor: grabbing;
    scale: 1.15;
  }

  .tool.returning {
    transition:
      left 0.35s cubic-bezier(0.3, 1.4, 0.5, 1),
      top 0.35s cubic-bezier(0.3, 1.4, 0.5, 1);
  }

  .hint {
    position: absolute;
    top: 100%;
    left: 50%;
    translate: -50% 4px;
    padding: 2px 7px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-size: 10.5px;
    font-weight: 750;
    white-space: nowrap;
  }

  .bubble {
    position: absolute;
    translate: -50% -50%;
    animation: float-up 0.9s ease-out forwards;
  }

  .meter {
    position: absolute;
    width: 64px;
    height: 8px;
    translate: -50% 0;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    overflow: hidden;
  }

  .meter span {
    display: block;
    height: 100%;
    background: var(--sky);
    transition: width 0.15s;
  }

  @keyframes pop-in {
    from {
      scale: 0.2;
      opacity: 0;
    }
  }

  @keyframes bob {
    0%,
    100% {
      transform: translateY(0) rotate(-4deg);
    }
    50% {
      transform: translateY(-4px) rotate(4deg);
    }
  }

  @keyframes float-up {
    from {
      opacity: 1;
      transform: translateY(0) scale(0.7);
    }
    to {
      opacity: 0;
      transform: translateY(-34px) scale(1.1);
    }
  }
</style>
