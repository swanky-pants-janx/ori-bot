<script lang="ts">
  import type { Snippet } from 'svelte'
  import { ICONS } from '../creature/icons'
  import PixelIcon from './PixelIcon.svelte'

  interface Props {
    title: string
    onclose: () => void
    children: Snippet
    footer?: Snippet
  }

  let { title, onclose, children, footer }: Props = $props()
</script>

<section class="panel" data-hit aria-label={title}>
  <header>
    <h2>{title}</h2>
    <button class="close" title="Close" aria-label="Close" onclick={onclose}>
      <PixelIcon glyph={ICONS.close} scale={1} />
    </button>
  </header>
  <div class="body">
    {@render children()}
  </div>
  {#if footer}
    <footer>{@render footer()}</footer>
  {/if}
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--paper);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
    animation: panel-in 0.2s cubic-bezier(0.3, 1.3, 0.5, 1);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 8px 16px;
    background: var(--paper-2);
    border-bottom: 2px solid var(--line);
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }

  .close {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 8px;
    background: transparent;
  }

  .close:hover {
    background: var(--paper-3);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--ink-faint) transparent;
  }

  footer {
    padding: 8px 10px 10px;
    border-top: 2px solid var(--line);
    background: var(--paper-2);
  }

  @keyframes panel-in {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
