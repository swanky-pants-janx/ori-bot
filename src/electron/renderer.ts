import { join } from 'node:path'
import type { BrowserWindow, WebPreferences } from 'electron'

/** Locked-down settings shared by every window that shows our UI. */
export const SECURE_WEB_PREFERENCES: WebPreferences = {
  preload: join(__dirname, '../preload/preload.js'),
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  backgroundThrottling: false,
  spellcheck: false
}

/** Load the UI (dev server in development, bundled files when packaged). `view` picks what to show. */
export function loadUi(win: BrowserWindow, view?: string): void {
  // Lock down navigation: our windows only ever show our own UI.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void win.loadURL(view ? `${devUrl}#${view}` : devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), view ? { hash: view } : undefined)
}
