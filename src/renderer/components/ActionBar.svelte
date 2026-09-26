<script lang="ts">
  import type { PanelName } from '../../types/api'
  import type { PetActionType, PetSnapshot } from '../../types/pet'
  import { ICONS, type IconName } from '../creature/icons'
  import PixelIcon from './PixelIcon.svelte'

  interface Props {
    snapshot: PetSnapshot
    panel: PanelName | null
    tool: 'apple' | 'sponge' | null
    ballOut: boolean
    visible: boolean
    onact: (action: PetActionType) => void
    onpanel: (panel: PanelName) => void
    onhide: () => void
    onhover: (hovering: boolean) => void
  }

  let { snapshot, panel, tool, ballOut, visible, onact, onpanel, onhide, onhover }: Props = $props()

  /** Which care buttons currently have their toy out. */
  const active = $derived<Partial<Record<PetActionType, boolean>>>({
    feed: tool === 'apple',
    clean: tool === 'sponge',
    play: ballOut
  })

  const sleeping = $derived(snapshot.state.sleeping)
  const care = $derived<{ action: PetActionType; icon: IconName; label: string }[]>([
    { action: 'feed', icon: 'feed', label: tool === 'apple' ? 'Put the apple away' : `Feed (drag the apple to ${snapshot.info.name})` },
    { action: 'pet', icon: 'pet', label: 'Pet' },
    { action: 'play', icon: 'play', label: ballOut ? 'Put the ball away' : 'Play (throw the ball!)' },
    sleeping
      ? { action: 'wake', icon: 'wake', label: 'Wake up' }
      : { action: 'sleep', icon: 'sleep', label: 'Put to bed' },
    { action: 'clean', icon: 'clean', label: tool === 'sponge' ? 'Put the sponge away' : 'Bath (scrub with the sponge)' }
  ])
  const tools: { panel: PanelName; icon: IconName; label: string }[] = [
    { panel: 'chat', icon: 'chat', label: 'Talk' },
    { panel: 'stats', icon: 'stats', label: 'Stats' },
    { panel: 'settings', icon: 'settings', label: 'Settings' }
  ]
</script>

<div
  class="bar"
  class:visible
  data-hit={visible ? true : undefined}
  role="group"
  aria-label="Care for {snapshot.info.name}"
  onmouseenter={() => onhover(true)}
  onmouseleave={() => onhover(false)}
>
  <div class="group">
    {#each care as c (c.action)}
      <button
        class="btn"
        class:wanted={snapshot.request?.action === c.action}
        class:active={active[c.action]}
        class:dim={sleeping && c.action !== 'wake' && c.action !== 'pet'}
        title={c.label}
        aria-label={c.label}
        onclick={() => onact(c.action)}
      >
        <PixelIcon glyph={ICONS[c.icon]} scale={2} />
      </button>
    {/each}
  </div>
  <div class="group">
    {#each tools as t (t.panel)}
      <button class="btn" class:active={panel === t.panel} title={t.label} aria-label={t.label} onclick={() => onpanel(t.panel)}>
        <PixelIcon glyph={ICONS[t.icon]} scale={2} />
      </button>
    {/each}
    <button class="btn" title="Hide (bring back from the tray)" aria-label="Hide" onclick={onhide}>
      <PixelIcon glyph={ICONS.hide} scale={2} />
    </button>
  </div>
</div>

<style>
  .bar {
    display: flex;
    gap: 6px;
    justify-content: center;
    opacity: 0;
    transform: translateY(-6px) scale(0.96);
    pointer-events: none;
    transition:
      opacity 0.18s,
      transform 0.18s;
  }

  .bar.visible {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }

  .group {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--paper);
    border: 2px solid var(--ink);
    border-radius: 999px;
    box-shadow: var(--shadow-sm);
  }

  .btn {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    transition:
      background 0.12s,
      transform 0.12s;
  }

  .btn:hover {
    background: var(--paper-3);
    transform: translateY(-2px);
  }

  .btn:active {
    transform: translateY(1px) scale(0.92);
  }

  .btn.active {
    background: var(--mint);
  }

  .btn.dim {
    opacity: 0.45;
  }

  .btn.wanted {
    background: #ffe3dd;
    box-shadow: 0 0 0 2px var(--coral);
    animation: wiggle 0.9s ease-in-out infinite;
  }

  @keyframes wiggle {
    0%,
    100% {
      rotate: 0deg;
    }
    25% {
      rotate: -10deg;
    }
    75% {
      rotate: 10deg;
    }
  }
</style>
