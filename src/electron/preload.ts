import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type OriApi } from '../types/api'

/** Subscribe to a main→renderer channel; returns an unsubscribe function. */
function listen<T>(channel: string, cb: (value: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, value: T): void => cb(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

/** The renderer never gets Node or raw IPC – only this typed, minimal API. */
const api: OriApi = {
  pet: {
    getSnapshot: () => ipcRenderer.invoke(IPC.petGetSnapshot),
    act: (action) => ipcRenderer.invoke(IPC.petAct, action),
    rename: (name) => ipcRenderer.invoke(IPC.petRename, name),
    adoptNew: (name) => ipcRenderer.invoke(IPC.petAdoptNew, name),
    cheat: (cheat) => ipcRenderer.invoke(IPC.petCheat, cheat),
    check: (action) => ipcRenderer.invoke(IPC.petCheck, action),
    onSnapshot: (cb) => listen(IPC.petSnapshot, cb),
    onSpeech: (cb) => listen(IPC.petSpeech, cb)
  },
  chat: {
    send: (message) => ipcRenderer.invoke(IPC.chatSend, message),
    history: (limit) => ipcRenderer.invoke(IPC.chatHistory, limit),
    clear: () => ipcRenderer.invoke(IPC.chatClear)
  },
  memory: {
    list: () => ipcRenderer.invoke(IPC.memoryList),
    delete: (id) => ipcRenderer.invoke(IPC.memoryDelete, id)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch),
    setApiKey: (provider, key) => ipcRenderer.invoke(IPC.settingsSetApiKey, provider, key),
    clearApiKey: (provider) => ipcRenderer.invoke(IPC.settingsClearApiKey, provider),
    testAI: () => ipcRenderer.invoke(IPC.settingsTestAI),
    onChange: (cb) => listen(IPC.settingsChanged, cb)
  },
  toy: {
    spawnBall: () => ipcRenderer.send(IPC.toySpawnBall),
    dismissBall: () => ipcRenderer.send(IPC.toyDismissBall),
    grab: () => ipcRenderer.send(IPC.toyGrab),
    release: () => ipcRenderer.send(IPC.toyRelease),
    onBall: (cb) => listen(IPC.toyBall, cb),
    onVanish: (cb) => listen(IPC.toyVanish, cb)
  },
  window: {
    ready: () => ipcRenderer.send(IPC.uiReady),
    dragStart: () => ipcRenderer.send(IPC.windowDragStart),
    dragEnd: () => ipcRenderer.send(IPC.windowDragEnd),
    setIgnoreMouse: (ignore) => ipcRenderer.send(IPC.windowIgnoreMouse, ignore),
    setPanel: (panel) => ipcRenderer.invoke(IPC.windowSetPanel, panel),
    hide: () => ipcRenderer.send(IPC.windowHide),
    resetPosition: () => ipcRenderer.send(IPC.windowResetPosition),
    fly: (mode) => ipcRenderer.send(IPC.windowFly, mode),
    setBusy: (busy) => ipcRenderer.send(IPC.windowBusy, busy),
    onCursor: (cb) => listen(IPC.windowCursor, cb),
    onMotion: (cb) => listen(IPC.windowMotion, cb),
    onActivity: (cb) => listen(IPC.desktopActivity, cb),
    onOpenPanel: (cb) => listen(IPC.uiOpenPanel, cb)
  }
}

contextBridge.exposeInMainWorld('ori', api)
