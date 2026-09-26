<script lang="ts">
  import type { Speech } from '../../types/chat'
  import { play } from '../services/sound'

  interface Props {
    speech: Speech | null
    /** Called once the full line has been revealed (used for text-to-speech). */
    onrevealed?: (speech: Speech) => void
  }

  let { speech, onrevealed }: Props = $props()

  let shown = $state('')
  let visible = $state(false)
  let current: Speech | null = null
  let typeTimer: ReturnType<typeof setInterval> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    if (!speech || speech === current) return
    start(speech)
  })

  function start(s: Speech): void {
    current = s
    clearInterval(typeTimer)
    clearTimeout(hideTimer)
    shown = ''
    visible = true
    const chars = [...s.text]
    let i = 0
    typeTimer = setInterval(() => {
      i++
      shown = chars.slice(0, i).join('')
      if (i % 3 === 1 && /\w/.test(chars[i - 1] ?? '')) play('blip')
      if (i >= chars.length) {
        clearInterval(typeTimer)
        onrevealed?.(s)
        hideTimer = setTimeout(() => (visible = false), Math.min(9000, 2600 + chars.length * 55))
      }
    }, 28)
  }

  function dismiss(): void {
    clearInterval(typeTimer)
    clearTimeout(hideTimer)
    visible = false
  }

  /** Split "*wiggles* hi!" into styled stage directions and speech. */
  const parts = $derived(
    shown.split(/(\*[^*]*\*?)/).filter(Boolean).map((text) => ({ text, action: text.startsWith('*') }))
  )
</script>

{#if visible && shown}
  <button class="bubble" data-hit onclick={dismiss} title="Click to dismiss" aria-live="polite">
    <span class="text">
      {#each parts as part, i (i)}
        {#if part.action}<em>{part.text.replaceAll('*', '')}</em>{:else}{part.text}{/if}
      {/each}
    </span>
  </button>
{/if}

<style>
  .bubble {
    position: relative;
    max-width: 250px;
    margin: 0 auto;
    padding: 8px 13px;
    border: 2px solid var(--ink);
    border-radius: 16px;
    background: #fff;
    box-shadow: var(--shadow-sm);
    font-size: 13.5px;
    font-weight: 650;
    line-height: 1.3;
    text-align: center;
    overflow-wrap: anywhere;
    cursor: default;
    animation: pop-in 0.22s cubic-bezier(0.3, 1.6, 0.5, 1);
  }

  .bubble::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -8px;
    width: 12px;
    height: 12px;
    background: #fff;
    border-right: 2px solid var(--ink);
    border-bottom: 2px solid var(--ink);
    transform: translateX(-50%) rotate(45deg);
  }

  .text {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 5;
    line-clamp: 5;
    overflow: hidden;
  }

  em {
    color: var(--ink-soft);
    font-weight: 600;
  }

  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.85);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
