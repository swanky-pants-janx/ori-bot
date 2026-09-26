<script lang="ts">
  import type { Memory } from '../../types/memory'
  import { LIFE_STAGE_IDS, MOOD_IDS, type Cheat, type CheatNeed, type LifeStage, type PetSnapshot } from '../../types/pet'
  import { CREATURE_IDS, type AIProviderId, type PublicSettings, type SettingsPatch } from '../../types/settings'
  import { CREATURE_INFO, CREATURES, sizeFactor } from '../creature'
  import Creature from '../creature/Creature.svelte'
  import type { Expression } from '../creature/expressions'
  import { api } from '../lib/api'
  import { MOOD_LABEL } from '../lib/labels'
  import { app } from '../lib/state.svelte'
  import Panel from './Panel.svelte'
  import Toggle from './Toggle.svelte'

  interface Props {
    snapshot: PetSnapshot
    settings: PublicSettings
    onclose: () => void
  }

  let { snapshot, settings, onclose }: Props = $props()

  // Text fields are edited locally and committed on blur / Enter.
  // svelte-ignore state_referenced_locally
  let petName = $state(snapshot.info.name)
  // svelte-ignore state_referenced_locally
  let ownerName = $state(settings.ownerName)
  // svelte-ignore state_referenced_locally
  let anthropicModel = $state(settings.anthropicModel)
  // svelte-ignore state_referenced_locally
  let ollamaUrl = $state(settings.ollamaUrl)
  // svelte-ignore state_referenced_locally
  let ollamaModel = $state(settings.ollamaModel)
  let apiKey = $state('')
  let replacingKey = $state(false)
  let testing = $state(false)
  let testResult = $state<{ ok: boolean; message: string } | null>(null)
  let memories = $state<Memory[] | null>(null)
  let adopting = $state(false)
  let newPetName = $state('')

  const STAGE_LABEL: Record<LifeStage, string> = { baby: 'Baby', child: 'Child', teen: 'Teen', adult: 'Adult' }
  const SKIPS: { hours: number; label: string }[] = [
    { hours: 1, label: '+1 hour' },
    { hours: 8, label: '+8 hours' },
    { hours: 24, label: '+1 day' }
  ]
  const NEEDS: { preset: CheatNeed; label: string }[] = [
    { preset: 'full', label: 'Fill all ♥' },
    { preset: 'dirty', label: 'Make dirty' }
  ]

  let cheatError = $state<string | null>(null)

  async function fly(mode: 'wander' | 'follow' | 'perch'): Promise<void> {
    // The pet can't fly with a panel open, so close it first.
    await app.closePanel()
    setTimeout(() => api.window.fly(mode), 250)
  }

  async function cheat(c: Cheat): Promise<void> {
    cheatError = null
    // Drop any lingering speech emotion so the chosen mood shows immediately.
    if (c.kind === 'mood') app.emotion = null
    try {
      await api.pet.cheat(c)
    } catch (err) {
      cheatError = `That cheat didn't work: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  const PREVIEW_FACE: Expression = { eyes: 'open', mouth: 'smile', blush: true }
  const NO_LOOK = { x: 0, y: 0 }

  const PROVIDERS: { id: AIProviderId; label: string }[] = [
    { id: 'none', label: 'Off' },
    { id: 'anthropic', label: 'Claude' },
    { id: 'ollama', label: 'Local' }
  ]

  function update(patch: SettingsPatch): void {
    testResult = null
    void api.settings.update(patch)
  }

  function commitPetName(): void {
    const name = petName.trim()
    if (name && name !== snapshot.info.name) void api.pet.rename(name)
    else petName = snapshot.info.name
  }

  async function saveKey(): Promise<void> {
    if (!apiKey.trim()) return
    await api.settings.setApiKey('anthropic', apiKey)
    apiKey = ''
    replacingKey = false
    testResult = null
  }

  async function test(): Promise<void> {
    testing = true
    testResult = null
    try {
      testResult = await api.settings.testAI()
    } finally {
      testing = false
    }
  }

  async function loadMemories(): Promise<void> {
    memories = await api.memory.list()
  }

  async function forget(id: number): Promise<void> {
    await api.memory.delete(id)
    await loadMemories()
  }

  async function adopt(): Promise<void> {
    await api.pet.adoptNew(newPetName.trim() || 'Ori')
    adopting = false
    newPetName = ''
    memories = null
    onclose()
  }

  const onEnter = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
  }
</script>

<Panel title="Settings" {onclose}>
  <section>
    <h3>Look</h3>
    <div class="looks" role="radiogroup" aria-label="Look">
      {#each CREATURE_IDS as id (id)}
        <button
          class="look"
          class:on={settings.creature === id}
          role="radio"
          aria-checked={settings.creature === id}
          onclick={() => update({ creature: id })}
        >
          <span class="preview">
            <Creature
              art={CREATURES[id]}
              expression={PREVIEW_FACE}
              lifeStage={snapshot.lifeStage}
              cleanliness={100}
              look={NO_LOOK}
              scale={2.2 * sizeFactor(CREATURES[id])}
            />
          </span>
          <span class="look-name">{CREATURE_INFO[id].label}</span>
          <span class="look-blurb">{CREATURE_INFO[id].blurb}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3>Pet</h3>
    <label class="field">
      <span>Pet name</span>
      <input bind:value={petName} maxlength="24" onblur={commitPetName} onkeydown={onEnter} />
    </label>
    <label class="field">
      <span>Your name</span>
      <input
        bind:value={ownerName}
        maxlength="40"
        placeholder="So {snapshot.info.name} knows you"
        onblur={() => update({ ownerName })}
        onkeydown={onEnter}
      />
    </label>
  </section>

  <section>
    <h3>AI brain</h3>
    <div class="segmented" role="radiogroup" aria-label="AI provider">
      {#each PROVIDERS as p (p.id)}
        <button
          role="radio"
          aria-checked={settings.aiProvider === p.id}
          class:on={settings.aiProvider === p.id}
          onclick={() => update({ aiProvider: p.id })}>{p.label}</button
        >
      {/each}
    </div>

    {#if settings.aiProvider === 'none'}
      <p class="hint">Without a brain, {snapshot.info.name} still lives, eats and plays, but only has simple replies.</p>
    {:else if settings.aiProvider === 'anthropic'}
      {#if settings.hasApiKey.anthropic && !replacingKey}
        <div class="key-saved">
          <span>API key saved{settings.secureStorageAvailable ? ' in your keychain' : ''} ✓</span>
          <button class="link" onclick={() => (replacingKey = true)}>Replace</button>
          <button class="link" onclick={() => api.settings.clearApiKey('anthropic')}>Remove</button>
        </div>
      {:else}
        <form
          class="field inline"
          onsubmit={(e) => {
            e.preventDefault()
            void saveKey()
          }}
        >
          <span>Claude API key</span>
          <input type="password" bind:value={apiKey} placeholder="sk-ant-…" autocomplete="off" spellcheck="false" />
          <button type="submit" class="small" disabled={!apiKey.trim()}>Save</button>
        </form>
      {/if}
      {#if !settings.secureStorageAvailable}
        <p class="warn">No system keychain found – the key will be stored unencrypted on this computer.</p>
      {/if}
      <label class="field">
        <span>Model</span>
        <input
          bind:value={anthropicModel}
          spellcheck="false"
          onblur={() => update({ anthropicModel })}
          onkeydown={onEnter}
        />
      </label>
      <p class="hint">Get a key at console.anthropic.com. The key never leaves the main process.</p>
    {:else}
      <label class="field">
        <span>Ollama URL</span>
        <input bind:value={ollamaUrl} spellcheck="false" onblur={() => update({ ollamaUrl })} onkeydown={onEnter} />
      </label>
      <label class="field">
        <span>Model</span>
        <input bind:value={ollamaModel} spellcheck="false" onblur={() => update({ ollamaModel })} onkeydown={onEnter} />
      </label>
      <p class="hint">Runs fully offline. Install Ollama, then run <code>ollama pull {settings.ollamaModel}</code>.</p>
    {/if}

    {#if settings.aiProvider !== 'none'}
      <div class="test">
        <button class="small" onclick={test} disabled={testing}>{testing ? 'Testing…' : 'Test brain'}</button>
        {#if testResult}
          <span class:ok={testResult.ok} class:bad={!testResult.ok}>
            {testResult.ok ? `“${testResult.message}”` : testResult.message}
          </span>
        {/if}
      </div>
    {/if}
  </section>

  <section>
    <h3>Desktop</h3>
    <Toggle label="Always on top" checked={settings.alwaysOnTop} onchange={(v) => update({ alwaysOnTop: v })} />
    <Toggle
      label="Fly around"
      hint="Explores your screen on its own"
      checked={settings.roam}
      onchange={(v) => update({ roam: v })}
    />
    <Toggle
      label="Sit & walk on windows"
      hint={settings.platform === 'darwin' ? 'Lands on your windows and rides along' : 'macOS only for now'}
      disabled={!settings.roam || settings.platform !== 'darwin'}
      checked={settings.perchOnWindows}
      onchange={(v) => update({ perchOnWindows: v })}
    />
    <Toggle
      label="App awareness"
      hint={settings.platform === 'darwin'
        ? 'Reacts to the app you use (names only, stays on your Mac)'
        : 'macOS only for now'}
      disabled={settings.platform !== 'darwin'}
      checked={settings.appAwareness}
      onchange={(v) => update({ appAwareness: v })}
    />
    <Toggle
      label="Follow my cursor"
      hint="Sometimes tags along beside it"
      disabled={!settings.roam}
      checked={settings.followCursor}
      onchange={(v) => update({ followCursor: v })}
    />
    <Toggle
      label="Chatty"
      hint="Makes little remarks on its own"
      checked={settings.chatty}
      onchange={(v) => update({ chatty: v })}
    />
    <Toggle
      label="Start with computer"
      hint={settings.isPackaged ? undefined : 'Works in the installed app'}
      disabled={!settings.isPackaged || settings.platform === 'linux'}
      checked={settings.startWithComputer}
      onchange={(v) => update({ startWithComputer: v })}
    />
    <Toggle
      label="Start hidden"
      hint="Stay in the tray at launch"
      checked={settings.startHidden}
      onchange={(v) => update({ startHidden: v })}
    />
    <div class="buttons">
      <button class="small" onclick={() => api.window.resetPosition()}>Reset position</button>
      <button class="small" onclick={() => api.window.hide()}>Hide to tray</button>
    </div>
  </section>

  <section>
    <h3>Sound &amp; voice</h3>
    <Toggle label="Sound effects" checked={settings.soundEnabled} onchange={(v) => update({ soundEnabled: v })} />
    <Toggle
      label="Spoken replies"
      hint="Reads what {snapshot.info.name} says aloud"
      checked={settings.voiceEnabled}
      onchange={(v) => update({ voiceEnabled: v })}
    />
    <Toggle
      label="Voice input"
      hint="Coming soon (local Whisper)"
      disabled
      checked={settings.speechRecognitionEnabled}
      onchange={(v) => update({ speechRecognitionEnabled: v })}
    />
  </section>

  <section>
    <h3>Memories</h3>
    {#if memories === null}
      <button class="small" onclick={loadMemories}>Show what {snapshot.info.name} remembers</button>
    {:else if memories.length === 0}
      <p class="hint">Nothing yet. Tell {snapshot.info.name} about yourself!</p>
    {:else}
      <ul class="memories">
        {#each memories as m (m.id)}
          <li>
            <span class="content">{m.content}</span>
            <span class="importance" title="Importance">{m.importance}</span>
            <button class="link" onclick={() => forget(m.id)} aria-label="Forget this">Forget</button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section>
    <h3>Cheats</h3>
    <p class="hint">Instant changes to {snapshot.info.name}. Handy for seeing it grow up or trying out moods.</p>
    <span class="sub">Grow to</span>
    <div class="segmented four" role="radiogroup" aria-label="Life stage">
      {#each LIFE_STAGE_IDS as stage (stage)}
        <button
          role="radio"
          aria-checked={snapshot.lifeStage === stage}
          class:on={snapshot.lifeStage === stage}
          onclick={() => cheat({ kind: 'grow', stage })}>{STAGE_LABEL[stage]}</button
        >
      {/each}
    </div>
    <span class="sub">Mood <em>(eating, playing and grumpy last 20s)</em></span>
    <div class="moods" role="radiogroup" aria-label="Mood">
      {#each MOOD_IDS as mood (mood)}
        <button
          role="radio"
          aria-checked={snapshot.mood === mood}
          class:on={snapshot.mood === mood}
          onclick={() => cheat({ kind: 'mood', mood })}>{MOOD_LABEL[mood]}</button
        >
      {/each}
    </div>
    <span class="sub">Fly <em>(closes this panel)</em></span>
    <div class="buttons">
      <button class="small" onclick={() => fly('wander')}>Take off</button>
      <button class="small" onclick={() => fly('follow')}>Follow me</button>
      {#if settings.platform === 'darwin'}
        <button class="small" onclick={() => fly('perch')}>Land on a window</button>
      {/if}
    </div>
    <span class="sub">Skip ahead <em>(as if you were away)</em></span>
    <div class="buttons">
      {#each SKIPS as s (s.hours)}
        <button class="small" onclick={() => cheat({ kind: 'skip', hours: s.hours })}>{s.label}</button>
      {/each}
    </div>
    <span class="sub">Needs</span>
    <div class="buttons">
      {#each NEEDS as n (n.preset)}
        <button class="small" onclick={() => cheat({ kind: 'needs', preset: n.preset })}>{n.label}</button>
      {/each}
    </div>
    {#if cheatError}
      <p class="warn" role="alert">{cheatError}</p>
    {/if}
  </section>

  <section class="danger">
    <h3>Start over</h3>
    {#if adopting}
      <p class="hint">{snapshot.info.name}, its memories and your chats will be gone for good.</p>
      <label class="field">
        <span>New pet's name</span>
        <input bind:value={newPetName} maxlength="24" placeholder="Ori" />
      </label>
      <div class="buttons">
        <button class="small bad" onclick={adopt}>Say goodbye to {snapshot.info.name}</button>
        <button class="small" onclick={() => (adopting = false)}>Keep {snapshot.info.name}</button>
      </div>
    {:else}
      <button class="small" onclick={() => (adopting = true)}>Adopt a new pet…</button>
    {/if}
  </section>
</Panel>

<style>
  section {
    padding-bottom: 12px;
    margin-bottom: 12px;
    border-bottom: 2px dashed var(--line);
  }

  section:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  h3 {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .looks {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .look {
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 8px 6px 7px;
    border: 2px solid var(--line);
    border-radius: var(--radius-sm);
    background: #fff;
    transition:
      border-color 0.15s,
      transform 0.15s;
  }

  .look:hover {
    transform: translateY(-2px);
  }

  .look.on {
    border-color: var(--ink);
    background: var(--paper-2);
    box-shadow: var(--shadow-sm);
  }

  .preview {
    display: grid;
    place-items: end center;
    height: 70px;
  }

  .look-name {
    font-size: 12.5px;
    font-weight: 800;
  }

  .look-blurb {
    color: var(--ink-soft);
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1.25;
    text-align: center;
  }

  .field {
    display: grid;
    gap: 3px;
    margin: 6px 0;
  }

  .field span {
    font-size: 12px;
    font-weight: 700;
  }

  .field.inline {
    grid-template-columns: 1fr auto;
  }

  .field.inline span {
    grid-column: 1 / -1;
  }

  input {
    width: 100%;
    min-width: 0;
    padding: 6px 10px;
    border: 2px solid var(--ink);
    border-radius: 10px;
    background: #fff;
    outline: none;
    font-size: 12.5px;
    font-weight: 600;
  }

  input:focus {
    box-shadow: 0 0 0 3px rgba(110, 193, 255, 0.45);
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: 3px;
    gap: 3px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: #fff;
  }

  .segmented button {
    padding: 5px 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 12px;
    font-weight: 750;
  }

  .segmented button.on {
    background: var(--mint);
  }

  .segmented.four {
    grid-template-columns: repeat(4, 1fr);
  }

  .moods {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .moods button {
    padding: 5px 0;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-size: 11.5px;
    font-weight: 750;
    box-shadow: var(--shadow-sm);
  }

  .moods button:hover {
    background: var(--paper-3);
  }

  .moods button:active {
    transform: translateY(1px);
    box-shadow: none;
  }

  .moods button.on {
    background: var(--mint);
  }

  .sub {
    display: block;
    margin: 10px 0 4px;
    font-size: 12px;
    font-weight: 700;
  }

  .sub em {
    color: var(--ink-soft);
    font-style: normal;
    font-weight: 550;
  }

  .hint,
  .warn {
    margin: 6px 0 2px;
    color: var(--ink-soft);
    font-size: 11.5px;
    font-weight: 550;
    line-height: 1.35;
  }

  .warn {
    color: #b3471f;
  }

  code {
    padding: 0 4px;
    border-radius: 4px;
    background: var(--paper-3);
    font-size: 11px;
  }

  .key-saved {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
    font-size: 12px;
    font-weight: 700;
  }

  .key-saved span {
    flex: 1;
  }

  .small {
    padding: 5px 11px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-size: 11.5px;
    font-weight: 750;
    box-shadow: var(--shadow-sm);
  }

  .small:hover:not(:disabled) {
    background: var(--paper-3);
  }

  .small:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: none;
  }

  .small:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .small.bad {
    background: #ffd9d4;
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--ink-soft);
    font-size: 11.5px;
    font-weight: 700;
    text-decoration: underline;
  }

  .test {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 11.5px;
    font-weight: 650;
  }

  .ok {
    color: var(--mint-deep);
  }

  .bad {
    color: #c43b31;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .memories {
    display: grid;
    gap: 5px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .memories li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 8px;
    background: #fff;
    font-size: 11.5px;
    font-weight: 600;
  }

  .memories .content {
    flex: 1;
    user-select: text;
    -webkit-user-select: text;
  }

  .importance {
    color: var(--ink-faint);
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }
</style>
