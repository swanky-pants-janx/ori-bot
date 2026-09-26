<script lang="ts">
  import { describePersonality } from '../../game/personality'
  import { STAT_KEYS, TRAIT_KEYS, type PetSnapshot, type StatKey } from '../../types/pet'
  import { ICONS, type Glyph } from '../creature/icons'
  import { MOOD_LABEL } from '../lib/labels'
  import Panel from './Panel.svelte'
  import PixelIcon from './PixelIcon.svelte'

  interface Props {
    snapshot: PetSnapshot
    onclose: () => void
  }

  let { snapshot, onclose }: Props = $props()

  const STATS: Record<StatKey, { label: string; color: string; icon: Glyph }> = {
    hunger: { label: 'Tummy', color: 'var(--coral)', icon: ICONS.feed },
    happiness: { label: 'Joy', color: 'var(--sun)', icon: ICONS.play },
    energy: { label: 'Energy', color: 'var(--sky)', icon: ICONS.energy },
    health: { label: 'Health', color: 'var(--leaf)', icon: ICONS.health },
    cleanliness: { label: 'Clean', color: 'var(--lilac)', icon: ICONS.clean },
    affection: { label: 'Love', color: 'var(--pink)', icon: ICONS.pet }
  }

  const age = $derived.by(() => {
    const days = snapshot.state.age
    if (days < 1) {
      const h = Math.max(1, Math.round(days * 24))
      return `${h} hour${h === 1 ? '' : 's'} old`
    }
    const d = Math.floor(days)
    return `${d} day${d === 1 ? '' : 's'} old`
  })
  const born = $derived(new Date(snapshot.info.birthday).toLocaleDateString(undefined, { dateStyle: 'medium' }))
</script>

<Panel title="{snapshot.info.name}'s stats" {onclose}>
  <div class="summary">
    <span class="chip mood">{MOOD_LABEL[snapshot.mood]}</span>
    <span class="chip">{snapshot.lifeStage}</span>
    <span class="age">{age}</span>
  </div>

  <ul class="stats">
    {#each STAT_KEYS as key (key)}
      {@const value = Math.round(snapshot.state[key])}
      <li class:low={value < 25}>
        <span class="icon"><PixelIcon glyph={STATS[key].icon} scale={1} /></span>
        <span class="label">{STATS[key].label}</span>
        <span
          class="track"
          role="meter"
          aria-label={STATS[key].label}
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span class="fill" style="width: {value}%; background: {STATS[key].color}"></span>
        </span>
        <span class="value">{value}</span>
      </li>
    {/each}
  </ul>

  <h3>Personality</h3>
  <p class="blurb">{describePersonality(snapshot.personality)}</p>
  <ul class="traits">
    {#each TRAIT_KEYS as key (key)}
      <li>
        <span>{key}</span>
        <span class="mini"><span style="width: {snapshot.personality[key]}%"></span></span>
      </li>
    {/each}
  </ul>

  <p class="born">Hatched {born}</p>
</Panel>

<style>
  .summary {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
  }

  .chip {
    padding: 2px 9px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-size: 11.5px;
    font-weight: 750;
    text-transform: capitalize;
  }

  .chip.mood {
    background: var(--mint);
  }

  .age {
    margin-left: auto;
    color: var(--ink-soft);
    font-size: 12px;
    font-weight: 650;
  }

  .stats {
    display: grid;
    gap: 7px;
    margin: 0 0 14px;
    padding: 0;
    list-style: none;
  }

  .stats li {
    display: grid;
    grid-template-columns: 14px 52px 1fr 24px;
    align-items: center;
    gap: 7px;
  }

  .icon {
    display: grid;
    place-items: center;
  }

  .label {
    font-size: 12px;
    font-weight: 700;
  }

  .track {
    height: 12px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    transition: width 0.6s cubic-bezier(0.3, 1.2, 0.5, 1);
  }

  .value {
    font-size: 11.5px;
    font-weight: 750;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .low .track {
    animation: warn 1.2s ease-in-out infinite;
  }

  .low .value {
    color: #d8433a;
  }

  @keyframes warn {
    50% {
      border-color: #d8433a;
    }
  }

  h3 {
    margin: 0 0 4px;
    font-size: 12.5px;
    font-weight: 800;
  }

  .blurb {
    margin: 0 0 8px;
    color: var(--ink-soft);
    font-size: 12px;
    line-height: 1.35;
  }

  .traits {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px 14px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }

  .traits li {
    display: grid;
    gap: 2px;
    font-size: 11px;
    font-weight: 650;
    text-transform: capitalize;
    color: var(--ink-soft);
  }

  .mini {
    height: 5px;
    border-radius: 999px;
    background: var(--paper-3);
    overflow: hidden;
  }

  .mini span {
    display: block;
    height: 100%;
    background: var(--ink-soft);
    border-radius: 999px;
  }

  .born {
    margin: 0;
    color: var(--ink-faint);
    font-size: 11px;
    text-align: center;
  }
</style>
