<script lang="ts">
  import { onMount } from 'svelte'
  import type { PanelName } from '../types/api'
  import type { Speech } from '../types/chat'
  import { LAYOUT } from '../types/layout'
  import type { LifeStage, PetActionType } from '../types/pet'
  import ActionBar from './components/ActionBar.svelte'
  import ChatPanel from './components/ChatPanel.svelte'
  import Pet from './components/Pet.svelte'
  import SettingsPanel from './components/SettingsPanel.svelte'
  import SpeechBubble from './components/SpeechBubble.svelte'
  import StatsPanel from './components/StatsPanel.svelte'
  import ToyLayer from './components/ToyLayer.svelte'
  import { api } from './lib/api'
  import { app } from './lib/state.svelte'
  import { play, setSoundEnabled } from './services/sound'
  import { SystemVoice, type TextToSpeech } from './services/voice'

  /** Smaller (younger) pets leave more room above them; let the bubble sit just over their head. */
  const BUBBLE_DROP: Record<LifeStage, number> = { baby: 44, child: 34, teen: 22, adult: 10 }

  let petHover = $state(false)
  let barHover = $state(false)
  let barVisible = $state(false)
  let voice: TextToSpeech | null = null

  // Show the care buttons while hovering (with a short grace period) or while a panel is open.
  $effect(() => {
    if (petHover || barHover || app.panel !== null) {
      barVisible = true
      return
    }
    const t = setTimeout(() => (barVisible = false), 900)
    return () => clearTimeout(t)
  })

  // Sound effects stay off during calls (app awareness).
  $effect(() => setSoundEnabled((app.settings?.soundEnabled ?? true) && app.activity?.category !== 'call'))

  async function act(action: PetActionType): Promise<void> {
    // Feeding, washing and playing are hands-on; the rest happen instantly.
    if (action === 'feed') return startTool('apple', 'feed')
    if (action === 'clean') return startTool('sponge', 'clean')
    if (action === 'play') return toggleBall()
    const result = await api.pet.act(action)
    if (!result.ok) play('refuse')
  }

  /** Hand the user an apple or a sponge – if the pet is up for it. */
  async function startTool(tool: 'apple' | 'sponge', action: 'feed' | 'clean'): Promise<void> {
    if (app.tool === tool) return putToolAway()
    const check = await api.pet.check(action)
    if (!check.ok) {
      play('refuse')
      return
    }
    app.scrub = 0
    app.tool = tool
    api.window.setBusy(true)
    play('pop')
  }

  function putToolAway(): void {
    app.tool = null
    app.scrub = 0
    api.window.setBusy(false)
  }

  async function feedApple(): Promise<boolean> {
    const result = await api.pet.act('feed')
    if (!result.ok) {
      play('refuse')
      return false
    }
    putToolAway()
    return true
  }

  async function washed(): Promise<void> {
    const result = await api.pet.act('clean')
    if (!result.ok) play('refuse')
    putToolAway()
  }

  async function toggleBall(): Promise<void> {
    if (app.ball === 'out') {
      api.toy.dismissBall()
      return
    }
    const check = await api.pet.check('play')
    if (!check.ok) {
      play('refuse')
      return
    }
    // The pet can't chase with a panel open.
    if (app.panel) await app.closePanel()
    api.toy.spawnBall()
    play('pop')
  }

  function spoke(speech: Speech): void {
    if (!app.settings?.voiceEnabled) return
    voice ??= new SystemVoice()
    voice.speak(speech.text)
  }

  function togglePanel(panel: PanelName): void {
    play('pop')
    void app.togglePanel(panel)
  }

  onMount(() => {
    void app.init()

    // Transparent areas let clicks fall through to the desktop; only the pet
    // and its UI (marked data-hit) catch the mouse.
    let ignoring: boolean | null = null
    const setIgnore = (ignore: boolean): void => {
      if (ignore === ignoring) return
      ignoring = ignore
      api.window.setIgnoreMouse(ignore)
    }
    const onMove = (e: MouseEvent): void => {
      const hit = e.target instanceof Element && e.target.closest('[data-hit]')
      setIgnore(!hit)
    }
    const onLeave = (): void => setIgnore(true)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (app.tool) putToolAway()
      else if (app.panel) void app.closePanel()
    }
    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)
    window.addEventListener('keydown', onKey)
    setIgnore(true)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('keydown', onKey)
    }
  })
</script>

{#snippet panelView()}
  {#if app.snapshot && app.settings}
    <div class="panel-slot">
      {#if app.panel === 'stats'}
        <StatsPanel snapshot={app.snapshot} onclose={() => app.closePanel()} />
      {:else if app.panel === 'chat'}
        <ChatPanel
          snapshot={app.snapshot}
          settings={app.settings}
          onclose={() => app.closePanel()}
          onsettings={() => app.openPanel('settings')}
        />
      {:else if app.panel === 'settings'}
        <SettingsPanel snapshot={app.snapshot} settings={app.settings} onclose={() => app.closePanel()} />
      {/if}
    </div>
  {/if}
{/snippet}

<main style="--compact: {LAYOUT.compactHeight}px; --panel: {LAYOUT.panelHeight}px">
  {#if app.panel && app.layout === 'above'}{@render panelView()}{/if}

  {#if app.snapshot}
    <div class="compact">
      <div class="bubble-zone" style="--drop: {BUBBLE_DROP[app.snapshot.lifeStage]}px">
        <SpeechBubble speech={app.speech} onrevealed={spoke} />
      </div>
      <div class="pet-zone">
        <Pet snapshot={app.snapshot} onpet={() => act('pet')} onhover={(h) => (petHover = h)} />
      </div>
      <div class="bar-zone">
        <ActionBar
          snapshot={app.snapshot}
          panel={app.panel}
          tool={app.tool}
          ballOut={app.ball === 'out'}
          visible={barVisible}
          onact={act}
          onpanel={togglePanel}
          onhide={() => api.window.hide()}
          onhover={(h) => (barHover = h)}
        />
      </div>
      {#if app.tool}
        <ToyLayer
          tool={app.tool}
          petName={app.snapshot.info.name}
          onfeed={feedApple}
          onwashed={washed}
          ondismiss={putToolAway}
        />
      {/if}
    </div>
  {/if}

  {#if app.panel && app.layout === 'below'}{@render panelView()}{/if}
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .compact {
    position: relative;
    flex: none;
    display: grid;
    grid-template-rows: 100px 150px 40px;
    height: var(--compact);
  }

  .bubble-zone {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 12px 4px;
    transform: translateY(var(--drop, 0px));
    transition: transform 0.4s;
  }

  .pet-zone {
    display: flex;
    justify-content: center;
  }

  .bar-zone {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .panel-slot {
    flex: none;
    height: var(--panel);
    padding: 8px 8px 6px;
  }
</style>
