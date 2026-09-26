<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { PetSnapshot } from '../../types/pet'
  import type { PublicSettings } from '../../types/settings'
  import { CREATURES } from '../creature'
  import { ICONS } from '../creature/icons'
  import { api } from '../lib/api'
  import { app } from '../lib/state.svelte'
  import Panel from './Panel.svelte'
  import PixelIcon from './PixelIcon.svelte'

  interface Props {
    snapshot: PetSnapshot
    settings: PublicSettings
    onclose: () => void
    onsettings: () => void
  }

  let { snapshot, settings, onclose, onsettings }: Props = $props()

  interface Line {
    id: number
    role: 'user' | 'pet' | 'note'
    text: string
  }

  let lines = $state<Line[]>([])
  let draft = $state('')
  let list: HTMLElement | undefined = $state()
  let input: HTMLInputElement | undefined = $state()
  let nextId = 0

  const avatarColor = $derived(CREATURES[settings.creature].palette.b)
  const brainOff = $derived(
    settings.aiProvider === 'none' || (settings.aiProvider === 'anthropic' && !settings.hasApiKey.anthropic)
  )

  async function scrollDown(): Promise<void> {
    await tick()
    list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }

  function add(role: Line['role'], text: string): void {
    lines = [...lines, { id: nextId++, role, text }]
    void scrollDown()
  }

  async function send(): Promise<void> {
    const text = draft.trim()
    if (!text || app.thinking) return
    draft = ''
    add('user', text)
    app.thinking = true
    try {
      const reply = await api.chat.send(text)
      add('pet', reply.message)
      if (reply.error) add('note', `Brain hiccup: ${reply.error}`)
    } catch {
      add('note', "Couldn't send that message.")
    } finally {
      app.thinking = false
      input?.focus()
    }
  }

  onMount(() => {
    void api.chat.history(20).then((history) => {
      lines = history.map((m) => ({ id: nextId++, role: m.role, text: m.content }))
      void scrollDown()
    })
    input?.focus()
  })
</script>

<Panel title="Talk to {snapshot.info.name}" {onclose}>
  {#if brainOff}
    <div class="banner">
      <span>{snapshot.info.name}'s AI brain is off, so replies are simple.</span>
      <button onclick={onsettings}>Set up</button>
    </div>
  {/if}

  <div class="log" bind:this={list} aria-live="polite">
    {#if lines.length === 0}
      <p class="empty">Say hi to {snapshot.info.name}!</p>
    {/if}
    {#each lines as line (line.id)}
      <div class="line {line.role}">
        {#if line.role === 'pet'}<span class="avatar" style="background: {avatarColor}" aria-hidden="true"></span>{/if}
        <p>{line.text}</p>
      </div>
    {/each}
    {#if app.thinking}
      <div class="line pet thinking" aria-label="{snapshot.info.name} is thinking">
        <span class="avatar" style="background: {avatarColor}" aria-hidden="true"></span>
        <p><span class="dot"></span><span class="dot"></span><span class="dot"></span></p>
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <form
      class="composer"
      onsubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <input
        bind:this={input}
        bind:value={draft}
        placeholder={snapshot.state.sleeping ? `${snapshot.info.name} is asleep…` : 'Say something…'}
        maxlength="1000"
        aria-label="Message"
      />
      <button type="submit" disabled={!draft.trim() || app.thinking} aria-label="Send">
        <PixelIcon glyph={ICONS.send} scale={2} />
      </button>
    </form>
  {/snippet}
</Panel>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    padding: 7px 8px 7px 11px;
    border-radius: var(--radius-sm);
    background: #fff3c4;
    font-size: 11.5px;
    font-weight: 650;
    line-height: 1.3;
  }

  .banner button {
    flex: none;
    padding: 4px 10px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-size: 11.5px;
    font-weight: 750;
  }

  .log {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-height: 100%;
  }

  .empty {
    margin: auto;
    color: var(--ink-faint);
    font-weight: 650;
  }

  .line {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    max-width: 88%;
  }

  .line p {
    margin: 0;
    padding: 7px 11px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    overflow-wrap: anywhere;
    user-select: text;
    -webkit-user-select: text;
  }

  .line.user {
    align-self: flex-end;
  }

  .line.user p {
    background: var(--ink);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  .line.pet p {
    background: #fff;
    border: 2px solid var(--ink);
    border-bottom-left-radius: 4px;
  }

  .line.note {
    align-self: center;
    max-width: 100%;
  }

  .line.note p {
    padding: 2px 6px;
    color: var(--ink-soft);
    font-size: 11px;
    font-weight: 600;
    text-align: center;
  }

  .avatar {
    flex: none;
    width: 18px;
    height: 16px;
    border: 2px solid var(--ink);
    border-radius: 50% 50% 45% 45%;
    background: var(--mint);
  }

  .thinking p {
    display: flex;
    gap: 4px;
    padding: 10px 12px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ink-soft);
    animation: dot 1s ease-in-out infinite;
  }

  .dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes dot {
    0%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    50% {
      transform: translateY(-3px);
      opacity: 1;
    }
  }

  .composer {
    display: flex;
    gap: 6px;
  }

  .composer input {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    outline: none;
    font-size: 13px;
    font-weight: 600;
  }

  .composer input:focus {
    box-shadow: 0 0 0 3px rgba(110, 193, 255, 0.45);
  }

  .composer button {
    display: grid;
    place-items: center;
    width: 36px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--mint);
  }

  .composer button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
