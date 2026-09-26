import { Menu, Tray } from 'electron'
import type { PetService } from '../services/petService'
import type { SettingsService } from '../services/settingsService'
import type { PanelName } from '../types/api'
import type { Mood, PetActionType, PetSnapshot } from '../types/pet'
import { trayIcon } from './icons'
import type { PetWindow } from './window'

const MOOD_WORDS: Record<Mood, string> = {
  idle: 'content',
  happy: 'happy',
  sad: 'sad',
  hungry: 'hungry',
  sleepy: 'sleepy',
  angry: 'grumpy',
  excited: 'excited',
  sick: 'feeling sick',
  dizzy: 'dizzy',
  playing: 'playing',
  eating: 'eating',
  sleeping: 'asleep'
}

interface TrayDeps {
  window: PetWindow
  pets: PetService
  settings: SettingsService
  openPanel(panel: PanelName): void
  quit(): void
}

/** Menu-bar / system-tray presence with quick care actions. */
export function createTray({ window, pets, settings, openPanel, quit }: TrayDeps): Tray {
  const tray = new Tray(trayIcon())
  let lastKey = ''

  const act = (action: PetActionType) => () => {
    window.show()
    pets.act(action)
  }

  const rebuild = (snap: PetSnapshot): void => {
    const visible = window.win.isVisible()
    const s = settings.get()
    const key = [snap.info.name, snap.mood, snap.state.sleeping, visible, s.alwaysOnTop, s.roam].join('|')
    if (key === lastKey) return
    lastKey = key

    const name = snap.info.name
    tray.setToolTip(`${name} is ${MOOD_WORDS[snap.mood]}`)
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `${name} is ${MOOD_WORDS[snap.mood]}`, enabled: false },
        { type: 'separator' },
        { label: visible ? `Hide ${name}` : `Show ${name}`, click: () => window.toggle() },
        { type: 'separator' },
        { label: 'Feed', click: act('feed') },
        { label: 'Pet', click: act('pet') },
        { label: 'Play', click: act('play') },
        snap.state.sleeping ? { label: 'Wake up', click: act('wake') } : { label: 'Put to bed', click: act('sleep') },
        { label: 'Bath', click: act('clean') },
        { type: 'separator' },
        { label: 'Talk…', click: () => openPanel('chat') },
        { label: 'Stats…', click: () => openPanel('stats') },
        { label: 'Settings…', click: () => openPanel('settings') },
        { type: 'separator' },
        {
          label: `Let ${name} Fly Around`,
          type: 'checkbox',
          checked: s.roam,
          click: (item) => settings.update({ roam: item.checked })
        },
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: s.alwaysOnTop,
          click: (item) => settings.update({ alwaysOnTop: item.checked })
        },
        { type: 'separator' },
        { label: `Quit ${name}`, click: quit }
      ])
    )
  }

  rebuild(pets.snapshot())
  pets.onSnapshot(rebuild)
  settings.onChange(() => rebuild(pets.snapshot()))
  window.win.on('show', () => rebuild(pets.snapshot()))
  window.win.on('hide', () => rebuild(pets.snapshot()))
  // Windows/Linux convention: clicking the tray icon toggles the pet.
  if (process.platform !== 'darwin') tray.on('click', () => window.toggle())
  return tray
}
