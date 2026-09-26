# Ori

A tiny AI companion that lives on your desktop. Ori is a Tamagotchi-style pet: it gets hungry, tired and dirty in real time (even while the app is closed), has moods and a slowly evolving personality, remembers what you tell it, and can talk to you through Claude or a local model.

## Quick start

```bash
npm install
npm run dev
```

Ori appears in the bottom-right corner of your screen and in the menu bar / system tray.

| Do this | What happens |
|---|---|
| Click Ori | Pet it |
| Drag Ori | Move it anywhere; the position is remembered |
| Hover Ori | Shows the care buttons: feed, pet, play, sleep/wake, bath, talk, stats, settings, hide |
| Feed | An apple pops out: drag it to Ori's mouth and he eats it |
| Bath | A sponge appears: scrub Ori until the meter fills |
| Play | A ball drops out: grab it and throw it anywhere on screen. It bounces with real physics, and Ori flies after it, catches it, and tosses it back |
| Shake Ori while dragging | Makes it dizzy. Playful pets love it; others get upset. Shaking it awake is not appreciated |

On macOS Ori also lands on top of your other windows and sometimes waddles along them. If you move a window he rides along; if you close it, minimise it, or cover his spot, he falls off and lands on the next window down or the bottom of the screen. Drop him near a window's top edge and he sits on it. Window positions come from the built-in `osascript`, so there's no permission prompt and window titles are never read.

**App awareness** (off by default, Settings → Desktop) lets him notice which app is in front, by name only (nothing leaves your Mac). He comments now and then ("Jy code weer!"), dances to Spotify or Music, and goes quiet during Zoom, Teams or FaceTime calls. The AI brain is told what you're up to ("coding in VS Code").

Ori also flies around your screen on its own now and then, and sometimes tags along beside your cursor. How often depends on its mood and personality. It stays put while you're hovering over it, dragging it, or have a panel open. Turn this off in **Settings → Desktop** or from the tray menu.
| Tray icon | The same actions, plus show/hide, always-on-top and quit |

Ori speaks his own playful, broken mix of Afrikaans and English ("Whooo!!", "Ek is Ori!", "Wow, dit is so cool", "Ek hou van party"). He's a proud trans bunny moth (he/him), and he gets very chatty when he's excited or happy, sometimes rattling off a few lines in a row. He's quieter when he's content, and mumbles in his sleep. His scripted lines live in `src/game/dialogue.ts`; the AI brain is taught the same voice in `src/ai/prompt.ts`.

To give Ori an AI brain, open **Settings → AI brain**:

- **Claude**: paste an API key from [console.anthropic.com](https://console.anthropic.com). The default model is `claude-opus-5`.
- **Local**: install [Ollama](https://ollama.com) and run `ollama pull llama3.2`. Works fully offline.
- **Off**: Ori still lives, eats and plays, and answers with simple built-in replies.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run with hot reload (UI) and auto-restart (main process and preload) |
| `npm start` | Preview the production build |
| `npm run build` | Typecheck and build into `out/` |
| `npm run package` | Build installers into `release/<version>/` (DMG + zip on macOS, NSIS on Windows, AppImage on Linux) |
| `npm run package:dir` | Build an unpacked app only (faster) |
| `npm test` | Unit tests (game engine, database, AI, services, artwork) |
| `npm run typecheck` | `tsc` for main-process code, `svelte-check` for the UI |
| `npm run lint` | ESLint |
| `npm run icons` | Re-render `build/icon.png` from the pet's sprite |

Set `ORI_USER_DATA=/some/dir` to run with a throwaway pet instead of your real one.

**Cheats** (Settings → Cheats) let you:

- jump to any life stage
- pick any of the 12 moods (the engine sets real state to match, so the AI sees it too)
- make it take off or follow your cursor right now
- skip ahead in time (the real simulation is replayed, as if you'd been away)
- fill all needs, or make the pet dirty

They go through the game engine like everything else (`PetEngine.cheat`).

## How it works

```
src/
├── game/        Pure simulation: needs, time progression, actions, mood, personality, events, dialogue
├── ai/          Provider interface, Claude + Ollama providers, prompt/context building, memory selection
├── database/    SQLite (Electron's built-in node:sqlite), migrations, repositories
├── services/    PetService (the living loop), ChatService, SettingsService
├── electron/    Main process: window, tray, IPC, presence detection, keychain, preload bridge
├── renderer/    Svelte 5 UI: pet, speech bubble, panels, sounds, voice
│   └── creature/  Pixel-art data + renderer (swap this to reskin the pet)
├── types/       Shared types, including the full IPC contract (types/api.ts)
└── utils/
```

**The game engine is authoritative.** `game/` has no Electron, Svelte or I/O dependencies. The main process runs it (`services/petService.ts`), persists it, and pushes snapshots to the UI. The UI and the AI can only *ask* for things.

**Real time, not a timer.** `game/simulation.ts` advances the pet from its last saved timestamp to "now" in one-minute steps, on every tick and on launch. Eight hours closed means eight hours of hunger, tiredness and dirt. The pet falls asleep when exhausted and wakes when rested, whether or not the app is open. The tuning numbers are all in `game/tuning.ts`.

**Mood is derived, never stored.** `game/mood.ts` turns stats into one of: idle, happy, sad, hungry, sleepy, angry, excited, sick, playing, eating, sleeping.

**Personality drifts slowly.** Each kind of interaction nudges a trait by a fraction of a point, at most once per 15 minutes. Long neglect erodes affection.

**Events** (`PET_FED`, `PET_HUNGRY`, `USER_RETURNED`, …) are stored in SQLite and fed to the AI as recent history. Ori notices when you come back after being idle, locked or asleep, and greets you.

### AI

- `ai/types.ts` defines `AIProvider.chat(messages, context)`. Adding a provider means implementing that interface and adding a case in `ai/index.ts`.
- `ai/context.ts` and `ai/prompt.ts` build the prompt from the real game state: stats as words, personality, relevant memories and recent events. Stable instructions come first so Claude can cache them.
- The model replies with structured JSON: `message`, `emotion` (visual only), an optional `action` request (`REQUEST_FOOD`, `REQUEST_PLAY`, …) and an optional memory to keep.
- Requests go through `game/requests.ts`, which accepts only those that match reality: a full pet can't beg for food. An accepted request makes the matching care button pulse.
- Memories are scored by importance, recency and keyword overlap (`ai/memory.ts`). Small talk is never stored. A few obvious facts (your name, likes, favourites) are picked up even without an AI.
- The Claude provider uses the official SDK with low effort (fast, short replies) and server-side refusal fallbacks (`fallbacks: "default"`) on models that support them.

### Security

- The renderer is sandboxed with context isolation and no Node. It only sees the typed `window.ori` API from `electron/preload.ts`.
- Every IPC payload is validated in `electron/ipc.ts`, and only the pet window may call in.
- API keys are encrypted with the OS keychain (Electron `safeStorage`) and never sent to the renderer, which only learns *whether* a key is saved.

### Looks (skins)

Pick a look in **Settings → Look**. There are two:

- **Ori**: a mint blob whose sprout grows into a flower.
- **Moth**: a fluffy cream moth whose tan ears grow taller with age and whose wings flap (faster when excited, folded while asleep).

A creature is pure data: a palette plus layered pixel grids (body, life-stage accessory, eye and mouth sets, cheeks, dirt), an optional animated `back` layer (the moth's wings), and optional per-mood colour changes (`tints` or `moodPalettes`). See `renderer/creature/ori.ts` and `moth.ts`.

To add a look:

1. Create a new `CreatureArt` file.
2. Register it in `renderer/creature/index.ts`.
3. Add its id to `CREATURE_IDS` in `types/settings.ts`.

`art.test.ts` checks every creature's grids automatically.

### Voice (in progress)

`renderer/services/voice.ts` defines `TextToSpeech` and `SpeechToText`. Spoken replies already work with system voices (**Settings → Spoken replies**). Voice input is stubbed so a local Whisper backend can be added without touching the chat flow.

## Data

Everything lives in one SQLite file, `ori.db`, in the app's data folder (`~/Library/Application Support/Ori` on macOS). Tables: `pets`, `pet_state`, `personality`, `memories`, `conversations`, `events`, `settings`.

## Roadmap

- [x] Milestone 1: desktop pet, care actions, stats, SQLite persistence, real-time offline progression
- [x] Milestone 2: AI chat, personality, memory, AI context, AI action requests
- [ ] Milestone 3: voice input (Whisper), better TTS (Piper). Spoken replies via system voices already work
- [x] Milestone 4: local LLM via Ollama
- [ ] Milestone 5: more polish: notifications, more animations and sounds, code signing
