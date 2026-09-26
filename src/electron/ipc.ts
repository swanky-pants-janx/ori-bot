import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import type { ChatService } from '../services/chatService'
import type { PetService } from '../services/petService'
import type { SettingsService } from '../services/settingsService'
import { IPC, type PanelName } from '../types/api'
import {
  CHEAT_NEEDS,
  LIFE_STAGE_IDS,
  MOOD_IDS,
  PET_ACTIONS,
  type Cheat,
  type CheatNeed,
  type LifeStage,
  type Mood,
  type PetActionType
} from '../types/pet'
import { KEYED_PROVIDERS, type KeyedProviderId, type SettingsPatch } from '../types/settings'
import type { Roamer } from './roamer'
import type { Toys } from './toys'
import type { PetWindow } from './window'

interface IpcDeps {
  window: PetWindow
  roamer: Roamer
  toys: Toys
  pets: PetService
  chat: ChatService
  settings: SettingsService
}

const PANELS: readonly PanelName[] = ['chat', 'stats', 'settings']

function isAction(v: unknown): v is PetActionType {
  return typeof v === 'string' && (PET_ACTIONS as readonly string[]).includes(v)
}

const MAX_SKIP_HOURS = 24 * 14

function parseCheat(v: unknown): Cheat {
  const c = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  if (c.kind === 'grow' && (LIFE_STAGE_IDS as readonly unknown[]).includes(c.stage)) {
    return { kind: 'grow', stage: c.stage as LifeStage }
  }
  if (c.kind === 'needs' && (CHEAT_NEEDS as readonly unknown[]).includes(c.preset)) {
    return { kind: 'needs', preset: c.preset as CheatNeed }
  }
  if (c.kind === 'mood' && (MOOD_IDS as readonly unknown[]).includes(c.mood)) {
    return { kind: 'mood', mood: c.mood as Mood }
  }
  if (c.kind === 'skip' && typeof c.hours === 'number' && c.hours > 0 && c.hours <= MAX_SKIP_HOURS) {
    return { kind: 'skip', hours: c.hours }
  }
  throw new Error('Unknown cheat')
}

function isKeyedProvider(v: unknown): v is KeyedProviderId {
  return typeof v === 'string' && (KEYED_PROVIDERS as readonly string[]).includes(v)
}

function text(v: unknown, max: number): string {
  if (typeof v !== 'string') throw new Error('Expected a string')
  return v.slice(0, max)
}

/**
 * The only bridge between UI and main process. Every payload is validated and
 * only our own window may call in.
 */
export function registerIpc({ window, roamer, toys, pets, chat, settings }: IpcDeps): void {
  const fromPet = (e: IpcMainEvent | IpcMainInvokeEvent): boolean => e.sender === window.win.webContents

  const handle = <T>(channel: string, fn: (...args: unknown[]) => T | Promise<T>): void => {
    ipcMain.handle(channel, (e, ...args) => {
      if (!fromPet(e)) throw new Error('Unauthorised sender')
      return fn(...args)
    })
  }
  const on = (channel: string, fn: (...args: unknown[]) => void): void => {
    ipcMain.on(channel, (e, ...args) => {
      if (fromPet(e)) fn(...args)
    })
  }

  // Pet
  handle(IPC.petGetSnapshot, () => pets.snapshot())
  handle(IPC.petAct, (action) => {
    if (!isAction(action)) throw new Error('Unknown action')
    return pets.act(action)
  })
  handle(IPC.petRename, (name) => pets.rename(text(name, 24)))
  handle(IPC.petCheat, (cheat) => pets.cheat(parseCheat(cheat)))
  handle(IPC.petCheck, (action) => {
    if (!isAction(action)) throw new Error('Unknown action')
    return pets.check(action)
  })
  handle(IPC.petAdoptNew, (name) => {
    chat.clearHistory()
    return pets.adoptNew(text(name, 24))
  })

  // Chat & memory
  handle(IPC.chatSend, (message) => chat.send(text(message, 1000)))
  handle(IPC.chatHistory, (limit) => chat.history(typeof limit === 'number' ? Math.min(100, Math.max(1, limit)) : 30))
  handle(IPC.chatClear, () => chat.clearHistory())
  handle(IPC.memoryList, () => chat.listMemories())
  handle(IPC.memoryDelete, (id) => {
    if (typeof id !== 'number') throw new Error('Expected a memory id')
    chat.deleteMemory(id)
  })

  // Settings
  handle(IPC.settingsGet, () => settings.toPublic())
  handle(IPC.settingsUpdate, (patch) => {
    if (!patch || typeof patch !== 'object') throw new Error('Expected settings')
    settings.update(patch as SettingsPatch)
    return settings.toPublic()
  })
  handle(IPC.settingsSetApiKey, (provider, key) => {
    if (!isKeyedProvider(provider)) throw new Error('Unknown provider')
    settings.setApiKey(provider, text(key, 500))
    return settings.toPublic()
  })
  handle(IPC.settingsClearApiKey, (provider) => {
    if (!isKeyedProvider(provider)) throw new Error('Unknown provider')
    settings.clearApiKey(provider)
    return settings.toPublic()
  })
  handle(IPC.settingsTestAI, () => chat.testConnection())

  // Window
  on(IPC.uiReady, () => window.markReady())
  on(IPC.windowDragStart, () => window.dragStart())
  on(IPC.windowDragEnd, () => window.dragEnd())
  on(IPC.windowIgnoreMouse, (ignore) => window.setIgnoreMouse(ignore === true))
  on(IPC.windowHide, () => window.hide())
  on(IPC.windowResetPosition, () => window.resetPosition())
  on(IPC.windowBusy, (busy) => roamer.setHold('tool', busy === true))
  on(IPC.toySpawnBall, () => toys.spawnBall())
  on(IPC.toyDismissBall, () => toys.dismissBall())
  // These two come from the ball's own window.
  ipcMain.on(IPC.toyGrab, (e) => {
    if (toys.owns(e.sender)) toys.grab()
  })
  ipcMain.on(IPC.toyRelease, (e) => {
    if (toys.owns(e.sender)) toys.release()
  })
  on(IPC.windowFly, (mode) => {
    if (mode === 'wander' || mode === 'follow' || mode === 'perch') roamer.fly(mode)
  })
  handle(IPC.windowSetPanel, (panel) => {
    if (panel !== null && !PANELS.includes(panel as PanelName)) throw new Error('Unknown panel')
    return window.setPanel(panel !== null)
  })

  // Push updates to the UI
  pets.onSnapshot((snapshot) => window.send(IPC.petSnapshot, snapshot))
  pets.onSpeech((speech) => window.send(IPC.petSpeech, speech))
  settings.onChange(() => window.send(IPC.settingsChanged, settings.toPublic()))
}
