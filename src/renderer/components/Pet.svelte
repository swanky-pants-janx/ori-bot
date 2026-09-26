<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import type { LifeStage, PetActionType, PetSnapshot } from '../../types/pet'
  import Creature from '../creature/Creature.svelte'
  import { canLook, expressionFor } from '../creature/expressions'
  import { EFFECTS, ICONS, type Glyph } from '../creature/icons'
  import { CREATURES, sizeFactor } from '../creature'
  import type { Motion } from '../creature/types'
  import { api } from '../lib/api'
  import { app } from '../lib/state.svelte'
  import { play } from '../services/sound'
  import Particles from './Particles.svelte'
  import PixelIcon from './PixelIcon.svelte'

  interface Props {
    snapshot: PetSnapshot
    onpet: () => void
    onhover: (hovering: boolean) => void
  }

  let { snapshot, onpet, onhover }: Props = $props()

  const SCALE: Record<LifeStage, number> = { baby: 3.2, child: 3.6, teen: 4, adult: 4.3 }
  /** Where foam builds up on the body while being scrubbed (percent of the sprite). */
  const FOAM = [
    { x: 38, y: 48, s: 3 },
    { x: 62, y: 44, s: 2 },
    { x: 50, y: 68, s: 3 },
    { x: 28, y: 64, s: 2 },
    { x: 72, y: 62, s: 3 },
    { x: 44, y: 34, s: 2 },
    { x: 58, y: 78, s: 2 },
    { x: 34, y: 80, s: 3 },
    { x: 66, y: 30, s: 2 }
  ]
  const DRAG_THRESHOLD = 4
  const WANT_ICON: Record<PetActionType, Glyph> = {
    feed: ICONS.feed,
    play: ICONS.play,
    sleep: ICONS.sleep,
    wake: ICONS.wake,
    pet: ICONS.pet,
    clean: ICONS.clean
  }

  let frame = $state(0)
  let blinking = $state(false)
  let eatStartFrame = $state(0)
  let particles: Particles | undefined = $state()

  const expression = $derived(
    expressionFor({
      mood: snapshot.mood,
      activity: snapshot.activity?.type ?? null,
      emotion: app.emotion,
      held: app.held,
      falling: app.motion.state === 'falling',
      thinking: app.thinking,
      anticipating: app.anticipating,
      scrubbing: app.scrubbing,
      blinking,
      frame
    })
  )

  /** Nudge the eyes one pixel towards the cursor. */
  const flying = $derived(app.motion.state === 'flying' && !app.held)
  const walking = $derived(app.motion.state === 'walking' && !app.held)
  const falling = $derived(app.motion.state === 'falling' && !app.held)
  /** App awareness: music is on – dance! */
  const dancing = $derived(
    app.activity?.category === 'music' &&
      !flying &&
      !falling &&
      !app.held &&
      ['idle', 'happy', 'excited'].includes(snapshot.mood)
  )

  const look = $derived.by(() => {
    if (app.held || !canLook(expression.eyes)) return { x: 0, y: 0 }
    // In flight, look where we're going.
    if ((flying || walking) && app.motion.dir !== 0) return { x: app.motion.dir, y: 0 }
    const { dx, dy } = app.cursor
    return { x: Math.abs(dx) < 60 ? 0 : Math.sign(dx), y: dy < -90 ? -1 : dy > 150 ? 1 : 0 }
  })

  const art = $derived(CREATURES[app.settings?.creature ?? 'ori'])
  const scale = $derived(SCALE[snapshot.lifeStage] * sizeFactor(art))
  const tint = $derived(art.tints?.[snapshot.mood] ?? 'none')
  const motion = $derived<Motion>(
    app.held || flying || falling || dancing || snapshot.mood === 'excited' || snapshot.mood === 'playing' || snapshot.mood === 'dizzy'
      ? 'fast'
      : snapshot.mood === 'sleeping' || snapshot.mood === 'sick'
        ? 'still'
        : 'rest'
  )
  const want = $derived(
    snapshot.request ? WANT_ICON[snapshot.request.action] : snapshot.mood === 'hungry' ? ICONS.feed : null
  )
  // Bites cycle, so a long (cheat-held) meal keeps looking like eating.
  const appleFrame = $derived(Math.floor((frame - eatStartFrame) / 5) % EFFECTS.apple.length)

  // ---- Reactions to changes in the (authoritative) game state

  let lastActivity = ''
  $effect(() => {
    const a = snapshot.activity
    const key = a ? `${a.type}:${a.until}` : ''
    if (key && key !== lastActivity && a) react(a.type)
    lastActivity = key
  })

  let wasSleeping: boolean | null = null
  $effect(() => {
    const sleeping = snapshot.state.sleeping
    if (wasSleeping !== null && sleeping !== wasSleeping) play(sleeping ? 'sleep' : 'wake')
    wasSleeping = sleeping
  })

  let wasDizzy = false
  $effect(() => {
    const dizzy = snapshot.mood === 'dizzy'
    if (dizzy && !wasDizzy) play('dizzy')
    wasDizzy = dizzy
  })

  /** Emit particles without making the calling effect depend on the particle list. */
  function burst(kind: Parameters<Particles['burst']>[0], count: number, spread?: number): void {
    untrack(() => particles?.burst(kind, count, spread))
  }

  // Little music notes float up while dancing.
  $effect(() => {
    if (!dancing) return
    burst('note', 1, 90)
    const t = setInterval(() => burst('note', 1, 90), 1300)
    return () => clearInterval(t)
  })

  let lastStage: LifeStage | null = null
  $effect(() => {
    const stage = snapshot.lifeStage
    if (lastStage && stage !== lastStage) {
      play('grow')
      burst('sparkle', 10, 120)
    }
    lastStage = stage
  })

  function react(type: NonNullable<PetSnapshot['activity']>['type']): void {
    switch (type) {
      case 'eating':
        eatStartFrame = frame
        play('feed')
        setTimeout(() => burst('crumb', 6, 40), 500)
        break
      case 'petted':
        play('pet')
        burst('heart', 3)
        break
      case 'playing':
        play('play')
        burst('sparkle', 5, 110)
        break
      case 'bathing':
        play('clean')
        burst('bubble', 10, 110)
        setTimeout(() => burst('sparkle', 4, 100), 1800)
        break
    }
  }

  // ---- Pointer: click = pet, drag = move the window

  let down: { x: number; y: number } | null = null
  let dragging = false

  function pointerdown(e: PointerEvent): void {
    if (e.button !== 0) return
    down = { x: e.screenX, y: e.screenY }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  function pointermove(e: PointerEvent): void {
    if (!down || dragging) return
    if (Math.hypot(e.screenX - down.x, e.screenY - down.y) > DRAG_THRESHOLD) {
      dragging = true
      app.held = true
      api.window.dragStart()
    }
  }

  function endDrag(): void {
    if (dragging) api.window.dragEnd()
    dragging = false
    app.held = false
    down = null
  }

  function pointerup(): void {
    if (!down) return
    const wasDrag = dragging
    endDrag()
    if (!wasDrag) onpet()
  }

  onMount(() => {
    const frames = setInterval(() => frame++, 260)
    let blinkTimer: ReturnType<typeof setTimeout>
    const scheduleBlink = (): void => {
      blinkTimer = setTimeout(() => {
        blinking = true
        setTimeout(() => {
          blinking = false
          scheduleBlink()
        }, 140)
      }, 2200 + Math.random() * 4000)
    }
    scheduleBlink()
    window.addEventListener('blur', endDrag)
    return () => {
      clearInterval(frames)
      clearTimeout(blinkTimer)
      window.removeEventListener('blur', endDrag)
    }
  })
</script>

<div
  class="stage"
  data-hit
  role="button"
  tabindex="0"
  aria-label="{snapshot.info.name} – click to pet, drag to move"
  onpointerdown={pointerdown}
  onpointermove={pointermove}
  onpointerup={pointerup}
  onpointercancel={endDrag}
  onmouseenter={() => onhover(true)}
  onmouseleave={() => onhover(false)}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onpet()}
>
  <div
    class="shadow"
    class:small={snapshot.mood === 'excited' || snapshot.mood === 'playing'}
    class:flying
  ></div>

  {#if flying && app.motion.dir !== 0}
    <div class="whoosh" style="--dir: {app.motion.dir}" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>
  {/if}

  <div
    class="bob {snapshot.mood}"
    class:held={app.held}
    class:flying
    class:walking
    class:falling
    class:dancing
    class:dirty={snapshot.state.cleanliness < 25}
    style="--dir: {flying ? app.motion.dir : 0}; --walk: {walking ? app.motion.dir : 0}"
  >
    <div class="tint" style="filter: {tint}">
      <Creature
        {art}
        {expression}
        lifeStage={snapshot.lifeStage}
        cleanliness={snapshot.state.cleanliness}
        {look}
        {scale}
        {motion}
        mood={snapshot.mood}
      />
    </div>

    {#if snapshot.mood === 'sleeping'}
      <div class="zzz" aria-hidden="true">
        {#each [0, 1, 2] as i (i)}
          <span style="animation-delay: {i * 900}ms"><PixelIcon glyph={EFFECTS.z} scale={2 + (i % 2)} /></span>
        {/each}
      </div>
    {/if}

    {#if snapshot.mood === 'dizzy'}
      <div class="orbit" aria-hidden="true">
        {#each [0, 1, 2] as i (i)}
          <span style="animation-delay: {-i * 400}ms"><PixelIcon glyph={EFFECTS.sparkle} scale={3} /></span>
        {/each}
      </div>
    {/if}

    {#if snapshot.mood === 'sick'}
      <span class="drop" aria-hidden="true"><PixelIcon glyph={EFFECTS.drop} scale={3} /></span>
    {/if}

    {#if snapshot.mood === 'angry'}
      <span class="anger" aria-hidden="true"><PixelIcon glyph={EFFECTS.anger} scale={3} /></span>
    {/if}

    {#if snapshot.state.cleanliness < 25 && !snapshot.state.sleeping}
      <span class="stink left" aria-hidden="true"><PixelIcon glyph={EFFECTS.stink} scale={3} /></span>
      <span class="stink right" aria-hidden="true"><PixelIcon glyph={EFFECTS.stink} scale={3} /></span>
    {/if}

    {#if snapshot.mood === 'eating'}
      <span class="food" aria-hidden="true"><PixelIcon glyph={EFFECTS.apple[appleFrame]} scale={3} /></span>
    {/if}

    {#if snapshot.mood === 'playing' && app.ball === 'none'}
      <span class="ball" aria-hidden="true"><PixelIcon glyph={ICONS.play} scale={3} /></span>
    {/if}

    {#if app.tool === 'sponge' && app.scrub > 0.04}
      <div class="foam" aria-hidden="true">
        {#each FOAM.slice(0, Math.ceil(app.scrub * FOAM.length)) as f, i (i)}
          <span style="left: {f.x}%; top: {f.y}%"><PixelIcon glyph={EFFECTS.bubble} scale={f.s} /></span>
        {/each}
      </div>
    {/if}
  </div>

  {#if want && !snapshot.state.sleeping && !snapshot.activity}
    <div class="thought" class:request={!!snapshot.request} aria-label="wants something">
      <PixelIcon glyph={want} scale={2} />
    </div>
  {/if}

  <Particles bind:this={particles} />
</div>

<style>
  .stage {
    position: relative;
    width: 180px;
    height: 150px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 12px;
    cursor: grab;
    touch-action: none;
    outline: none;
  }

  .stage:active {
    cursor: grabbing;
  }

  .shadow {
    position: absolute;
    bottom: 8px;
    left: 50%;
    width: 96px;
    height: 12px;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(40, 25, 60, 0.28), rgba(40, 25, 60, 0) 70%);
    transition: width 0.3s;
  }

  .shadow.small {
    animation: shadow-hop 0.7s ease-in-out infinite;
  }

  .bob {
    position: relative;
    transform-origin: 50% 100%;
    animation: breathe 2.6s ease-in-out infinite;
    filter: drop-shadow(0 2px 0 rgba(59, 45, 79, 0.15));
  }

  .bob.happy {
    animation: bounce 1.3s ease-in-out infinite;
  }
  .bob.excited {
    animation: hop 0.7s cubic-bezier(0.3, 0, 0.3, 1) infinite;
  }
  .bob.playing {
    animation: play-jump 0.6s cubic-bezier(0.3, 0, 0.3, 1) infinite;
  }
  .bob.eating {
    animation: munch 0.52s ease-in-out infinite;
  }
  .bob.sad {
    animation: breathe 4.2s ease-in-out infinite;
  }
  .bob.hungry {
    animation: wobble 2.8s ease-in-out infinite;
  }
  .bob.sleepy {
    animation: sway 3.4s ease-in-out infinite;
  }
  .bob.sleeping {
    animation: sleep-breathe 3.6s ease-in-out infinite;
  }
  .bob.angry {
    animation: shake 0.35s linear infinite;
  }
  .bob.sick {
    animation: shiver 0.3s linear infinite;
  }

  /* Colour shifts (per creature, see CreatureArt.tints) apply to the body only, never to overlays. */
  .tint {
    transition: filter 0.6s;
  }
  .bob.held {
    animation: dangle 0.9s ease-in-out infinite;
    transform-origin: 50% 0%;
  }
  .bob.dizzy {
    animation: woozy 0.7s ease-in-out infinite;
  }
  .bob.held.dizzy {
    animation: dangle 0.3s ease-in-out infinite;
  }

  /* Flying: float, and lean into the direction of travel. */
  .bob {
    rotate: calc(var(--dir, 0) * 9deg);
    transition: rotate 0.35s ease;
  }
  .bob.flying {
    animation: fly 1.1s ease-in-out infinite;
  }
  .bob.walking {
    animation: waddle 0.5s ease-in-out infinite;
  }
  .bob.falling {
    animation: flail 0.25s linear infinite;
  }
  .bob.dancing {
    animation: dance 0.9s ease-in-out infinite;
  }
  @keyframes waddle {
    0%,
    100% {
      transform: translateY(0) rotate(-5deg);
    }
    25% {
      transform: translateY(-4px) rotate(0deg);
    }
    50% {
      transform: translateY(0) rotate(5deg);
    }
    75% {
      transform: translateY(-4px) rotate(0deg);
    }
  }
  @keyframes flail {
    0%,
    100% {
      transform: rotate(-10deg) scale(0.96, 1.06);
    }
    50% {
      transform: rotate(10deg) scale(0.96, 1.06);
    }
  }
  @keyframes dance {
    0%,
    100% {
      transform: translateX(0) rotate(0deg) scale(1, 1);
    }
    20% {
      transform: translateX(-5px) rotate(-8deg) scale(1.03, 0.95);
    }
    40% {
      transform: translateX(0) rotate(0deg) translateY(-7px);
    }
    60% {
      transform: translateX(5px) rotate(8deg) scale(1.03, 0.95);
    }
    80% {
      transform: translateX(0) rotate(0deg) translateY(-7px);
    }
  }
  .shadow.flying {
    width: 56px;
    opacity: 0.45;
  }

  .whoosh {
    position: absolute;
    top: 42%;
    left: 50%;
    display: grid;
    gap: 7px;
    transform: translateX(calc(var(--dir) * -96px - 50%));
  }
  .whoosh span {
    width: 18px;
    height: 3px;
    border-radius: 2px;
    background: var(--ink);
    opacity: 0;
    animation: whoosh 0.6s ease-out infinite;
  }
  .whoosh span:nth-child(2) {
    width: 12px;
    margin-left: 6px;
    animation-delay: 0.2s;
  }
  .whoosh span:nth-child(3) {
    animation-delay: 0.4s;
  }

  .orbit {
    position: absolute;
    top: 4%;
    left: 50%;
  }
  .orbit span {
    position: absolute;
    translate: -50% -50%;
    animation: orbit 1.2s linear infinite;
  }

  @keyframes fly {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
  @keyframes whoosh {
    0% {
      opacity: 0;
      transform: translateX(0);
    }
    30% {
      opacity: 0.35;
    }
    100% {
      opacity: 0;
      transform: translateX(calc(var(--dir) * -16px));
    }
  }
  @keyframes woozy {
    0%,
    100% {
      transform: rotate(-7deg) translateX(-2px);
    }
    50% {
      transform: rotate(7deg) translateX(2px);
    }
  }
  /* Stars circling the head on a flat ellipse, bigger when "in front". */
  @keyframes orbit {
    0% {
      transform: translate(-40px, 0) scale(0.8);
      opacity: 0.9;
    }
    12.5% {
      transform: translate(-28px, 7px) scale(1);
    }
    25% {
      transform: translate(0, 10px) scale(1.15);
      opacity: 1;
    }
    37.5% {
      transform: translate(28px, 7px) scale(1);
    }
    50% {
      transform: translate(40px, 0) scale(0.8);
    }
    62.5% {
      transform: translate(28px, -7px) scale(0.65);
    }
    75% {
      transform: translate(0, -10px) scale(0.55);
      opacity: 0.55;
    }
    87.5% {
      transform: translate(-28px, -7px) scale(0.65);
    }
    100% {
      transform: translate(-40px, 0) scale(0.8);
      opacity: 0.9;
    }
  }

  @keyframes breathe {
    0%,
    100% {
      transform: scale(1, 1);
    }
    50% {
      transform: scale(1.015, 0.965);
    }
  }
  @keyframes sleep-breathe {
    0%,
    100% {
      transform: scale(1.03, 0.92);
    }
    50% {
      transform: scale(1.05, 0.88);
    }
  }
  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0) scale(1, 1);
    }
    40% {
      transform: translateY(-5px) scale(0.98, 1.03);
    }
    80% {
      transform: translateY(0) scale(1.03, 0.96);
    }
  }
  @keyframes hop {
    0%,
    100% {
      transform: translateY(0) scale(1.06, 0.92);
    }
    15% {
      transform: translateY(0) scale(0.95, 1.06);
    }
    50% {
      transform: translateY(-16px) scale(0.98, 1.02);
    }
    85% {
      transform: translateY(0) scale(1, 1);
    }
  }
  @keyframes play-jump {
    0%,
    100% {
      transform: translateY(0) rotate(0deg) scale(1.05, 0.93);
    }
    45% {
      transform: translateY(-18px) rotate(-6deg);
    }
    55% {
      transform: translateY(-18px) rotate(6deg);
    }
  }
  @keyframes munch {
    0%,
    100% {
      transform: scale(1, 1);
    }
    50% {
      transform: scale(1.04, 0.94);
    }
  }
  @keyframes wobble {
    0%,
    60%,
    100% {
      transform: rotate(0deg);
    }
    70% {
      transform: rotate(-3deg);
    }
    80% {
      transform: rotate(3deg);
    }
    90% {
      transform: rotate(-2deg);
    }
  }
  @keyframes sway {
    0%,
    100% {
      transform: rotate(-3deg) scale(1, 0.97);
    }
    50% {
      transform: rotate(3deg) scale(1, 0.95);
    }
  }
  @keyframes shake {
    0%,
    100% {
      transform: translateX(0) scale(1.04);
    }
    25% {
      transform: translateX(-1.5px) scale(1.04);
    }
    75% {
      transform: translateX(1.5px) scale(1.04);
    }
  }
  @keyframes shiver {
    0%,
    100% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(1px);
    }
  }
  @keyframes dangle {
    0%,
    100% {
      transform: rotate(-7deg) scale(0.97, 1.05);
    }
    50% {
      transform: rotate(7deg) scale(0.97, 1.05);
    }
  }
  @keyframes shadow-hop {
    0%,
    100% {
      width: 100px;
      opacity: 1;
    }
    50% {
      width: 70px;
      opacity: 0.6;
    }
  }

  .foam {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .foam span {
    position: absolute;
    translate: -50% -50%;
    animation: foam-in 0.25s ease-out;
  }
  @keyframes foam-in {
    from {
      scale: 0;
    }
  }

  .zzz {
    position: absolute;
    top: -6px;
    right: -18px;
    width: 30px;
    height: 60px;
  }
  .zzz span {
    position: absolute;
    bottom: 0;
    left: 0;
    opacity: 0;
    animation: float-z 2.7s ease-out infinite;
  }
  @keyframes float-z {
    0% {
      opacity: 0;
      transform: translate(0, 10px);
    }
    20% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(18px, -40px);
    }
  }

  .drop {
    position: absolute;
    top: 18%;
    right: 6%;
    animation: drip 1.6s ease-in infinite;
  }
  @keyframes drip {
    0% {
      transform: translateY(0);
      opacity: 1;
    }
    100% {
      transform: translateY(14px);
      opacity: 0;
    }
  }

  .anger {
    position: absolute;
    top: 8%;
    right: 2%;
    animation: pulse 0.6s ease-in-out infinite;
  }

  .stink {
    position: absolute;
    top: 30%;
    animation: stink 1.4s ease-in-out infinite;
  }
  .stink.left {
    left: -14px;
  }
  .stink.right {
    right: -14px;
    animation-delay: 0.7s;
  }
  @keyframes stink {
    0%,
    100% {
      transform: translateY(0);
      opacity: 0.2;
    }
    50% {
      transform: translateY(-8px);
      opacity: 0.9;
    }
  }

  .food {
    position: absolute;
    right: -26px;
    bottom: 24%;
  }

  .ball {
    position: absolute;
    left: -34px;
    bottom: 10%;
    animation: ball 0.6s cubic-bezier(0.3, 0, 0.3, 1) infinite;
  }
  @keyframes ball {
    0%,
    100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-34px) rotate(180deg);
    }
  }

  .thought {
    position: absolute;
    top: 34px;
    right: -6px;
    padding: 5px;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
    animation: float 2.4s ease-in-out infinite;
  }
  .thought::after {
    content: '';
    position: absolute;
    bottom: -9px;
    left: 4px;
    width: 7px;
    height: 7px;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 50%;
  }
  .thought.request {
    border-color: var(--coral);
    animation: float 2.4s ease-in-out infinite, pulse 1.2s ease-in-out infinite;
  }
  @keyframes float {
    0%,
    100% {
      translate: 0 0;
    }
    50% {
      translate: 0 -4px;
    }
  }
  @keyframes pulse {
    0%,
    100% {
      scale: 1;
    }
    50% {
      scale: 1.12;
    }
  }
</style>
