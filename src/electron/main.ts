import { join } from 'node:path'
import { app, type Tray } from 'electron'
import { createDatabase, type Database } from '../database'
import { dialogue, RETURN_AFTER_MS } from '../game'
import { ChatService } from '../services/chatService'
import { PetService } from '../services/petService'
import { SettingsService } from '../services/settingsService'
import { IPC, type PanelName } from '../types/api'
import { registerIpc } from './ipc'
import { watchPresence } from './presence'
import { AppAwareness } from './desktop/awareness'
import { DesktopWatcher } from './desktop/watcher'
import { Roamer } from './roamer'
import { Toys } from './toys'
import { secretStore } from './secrets'
import { createTray } from './tray'
import { PetWindow } from './window'

app.setName('Ori')
// Lets development/testing use a throwaway pet without touching the real one.
if (process.env.ORI_USER_DATA) app.setPath('userData', process.env.ORI_USER_DATA)

let db: Database | null = null
let pets: PetService | null = null
let petWindow: PetWindow | null = null
let tray: Tray | null = null
let roamer: Roamer | null = null
let toys: Toys | null = null
let desktop: DesktopWatcher | null = null
let awareness: AppAwareness | null = null
let stopPresence: (() => void) | null = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => petWindow?.show())
  app.whenReady().then(start).catch((err) => {
    console.error('Ori failed to start:', err)
    app.exit(1)
  })
}

function start(): void {
  // A desktop pet lives in the tray, not the Dock (packaged builds set LSUIElement too).
  if (process.platform === 'darwin') app.dock?.hide()

  db = createDatabase(join(app.getPath('userData'), 'ori.db'))
  const settings = new SettingsService(db.settings, secretStore, {
    isPackaged: app.isPackaged,
    platform: process.platform
  })
  pets = new PetService(db, settings)
  const { awayMs, hatched } = pets.init()
  const chat = new ChatService(db, pets, settings)

  const window = new PetWindow(settings)
  petWindow = window
  desktop = new DesktopWatcher()
  roamer = new Roamer(window, pets, settings, desktop)
  awareness = new AppAwareness(desktop, settings, pets, roamer, window)
  toys = new Toys(window, roamer, pets)
  registerIpc({ window, roamer, toys, pets, chat, settings })
  window.onShake = () => pets?.shake()

  const openPanel = (panel: PanelName): void => {
    window.show()
    window.win.focus()
    window.send(IPC.uiOpenPanel, panel)
  }
  tray = createTray({ window, pets, settings, openPanel, quit: () => app.quit() })

  applyLoginItem(settings.get().startWithComputer)
  settings.onChange((s) => {
    window.setAlwaysOnTop(s.alwaysOnTop)
    applyLoginItem(s.startWithComputer)
  })

  stopPresence = watchPresence({
    away: () => pets?.userAway(),
    returned: (ms) => {
      if (!pets) return
      void chat.react(pets.userReturned(ms))
    }
  })

  window.win.once('ready-to-show', () => {
    if (!settings.get().startHidden) window.show()
    if (hatched) {
      pets?.say(dialogue.helloLine(pets.speaker()), 'script', 'excited')
    } else if (awayMs >= RETURN_AFTER_MS) {
      void chat.react(pets!.userReturned(awayMs))
    }
  })

  pets.start()
  roamer.start()
}

/** "Start hidden" is handled by our own setting at launch, so only the login flag is needed. */
function applyLoginItem(openAtLogin: boolean): void {
  // In development this would register the bare Electron binary, so only do it when packaged.
  if (!app.isPackaged || process.platform === 'linux') return
  if (app.getLoginItemSettings().openAtLogin !== openAtLogin) app.setLoginItemSettings({ openAtLogin })
}

app.on('before-quit', () => {
  toys?.destroy()
  awareness?.stop()
  roamer?.stop()
  desktop?.stop()
  stopPresence?.()
  pets?.stop()
  petWindow?.destroy()
  tray?.destroy()
  db?.close()
  pets = null
  db = null
})

// The pet window is hidden, never closed; if it does go away, quit cleanly.
app.on('window-all-closed', () => app.quit())
