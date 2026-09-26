import { BrowserWindow, screen, type Rectangle } from 'electron'
import type { SettingsService } from '../services/settingsService'
import type { PanelLayout } from '../types/api'
import { IPC } from '../types/api'
import { LAYOUT } from '../types/layout'
import type { WindowPosition } from '../types/settings'
import { clampAnchor, PET_OFFSET, ShakeDetector, type Point } from './motion'
import { loadUi, SECURE_WEB_PREFERENCES } from './renderer'

const { width: WIDTH, compactHeight: COMPACT, panelHeight: PANEL } = LAYOUT
const DRAG_FRAME_MS = 16
const CURSOR_POLL_MS = 80

/**
 * The floating pet window: frameless, transparent, always-on-top, draggable,
 * click-through on empty areas, and it grows toward free space when a panel opens.
 */
export class PetWindow {
  readonly win: BrowserWindow
  private layout: PanelLayout = 'none'
  private dragTimer: ReturnType<typeof setInterval> | null = null
  private dragSafety: ReturnType<typeof setTimeout> | null = null
  private cursorTimer: ReturnType<typeof setInterval> | null = null
  private lastCursor = { dx: NaN, dy: NaN }
  private ready = false
  private queue: [string, unknown][] = []
  /** The cursor is over the pet or its UI (the window is catching the mouse). */
  private hovering = false
  private readonly shake = new ShakeDetector()

  /** Called whenever the user reaches for the pet (hover, drag, panel). */
  onInteract: (kind: 'hover' | 'drag' | 'panel') => void = () => {}
  /** Called when the pet is shaken back and forth while being dragged. */
  onShake: () => void = () => {}
  /** Called when the user lets go of the pet after dragging it. */
  onDragEnd: () => void = () => {}

  constructor(private readonly settings: SettingsService) {
    const pos = this.validPosition(settings.get().windowPosition) ?? this.defaultPosition()

    this.win = new BrowserWindow({
      width: WIDTH,
      height: COMPACT,
      x: pos.x,
      y: pos.y,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      title: 'Ori',
      alwaysOnTop: settings.get().alwaysOnTop,
      webPreferences: SECURE_WEB_PREFERENCES
    })

    this.setAlwaysOnTop(settings.get().alwaysOnTop)
    if (process.platform === 'darwin') this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    this.win.on('show', () => this.startCursorTracking())
    this.win.on('hide', () => this.stopCursorTracking())
    this.win.webContents.on('did-start-loading', () => {
      this.ready = false
    })

    screen.on('display-removed', () => this.ensureVisible())
    screen.on('display-metrics-changed', () => this.ensureVisible())

    loadUi(this.win)
  }

  /** Send to the renderer, queueing until the UI has mounted. */
  send(channel: string, payload: unknown): void {
    if (this.win.isDestroyed()) return
    if (!this.ready) {
      this.queue.push([channel, payload])
      return
    }
    this.win.webContents.send(channel, payload)
  }

  markReady(): void {
    this.ready = true
    const pending = this.queue
    this.queue = []
    for (const [channel, payload] of pending) this.win.webContents.send(channel, payload)
  }

  show(): void {
    if (!this.win.isVisible()) this.win.showInactive()
  }

  hide(): void {
    this.win.hide()
  }

  toggle(): void {
    if (this.win.isVisible()) this.hide()
    else this.show()
  }

  setAlwaysOnTop(on: boolean): void {
    this.win.setAlwaysOnTop(on, 'floating')
  }

  setIgnoreMouse(ignore: boolean): void {
    this.hovering = !ignore
    if (this.hovering) this.onInteract('hover')
    // Linux can't forward mouse moves while ignoring, so keep the window clickable there.
    if (process.platform === 'linux' || this.dragTimer) return
    this.win.setIgnoreMouseEvents(ignore, { forward: true })
  }

  // ---- Autonomous movement (see roamer.ts)

  /** Free to be moved around: visible, not being dragged, no panel open. */
  canFly(): boolean {
    return !this.win.isDestroyed() && this.win.isVisible() && !this.dragTimer && this.layout === 'none'
  }

  /** Free to *start* a flight: additionally, the user isn't pointing at the pet. */
  canRoam(): boolean {
    return this.canFly() && !this.hovering
  }

  /** Move the compact window's top-left (only while no panel is open). */
  moveAnchor(p: Point): void {
    if (this.layout !== 'none' || this.win.isDestroyed()) return
    this.win.setPosition(Math.round(p.x), Math.round(p.y))
  }

  /** The usable area of the screen the pet is currently on. */
  workArea(): Rectangle {
    return screen.getDisplayMatching(this.win.getBounds()).workArea
  }

  // ---- Dragging: follow the cursor from the main process for smooth motion.

  dragStart(): void {
    if (this.dragTimer) return
    this.onInteract('drag')
    this.win.setIgnoreMouseEvents(false)
    const cursor = screen.getCursorScreenPoint()
    const [wx, wy] = this.win.getPosition()
    const offset = { x: cursor.x - wx, y: cursor.y - wy }
    this.shake.reset()
    this.dragTimer = setInterval(() => {
      const c = screen.getCursorScreenPoint()
      this.win.setPosition(c.x - offset.x, c.y - offset.y)
      if (this.shake.sample(c, Date.now())) this.onShake()
    }, DRAG_FRAME_MS)
    // Never get stuck following the cursor if the mouse-up was missed.
    this.dragSafety = setTimeout(() => this.dragEnd(), 60_000)
  }

  dragEnd(): void {
    if (!this.dragTimer) return
    clearInterval(this.dragTimer)
    if (this.dragSafety) clearTimeout(this.dragSafety)
    this.dragTimer = null
    this.dragSafety = null
    this.clampToScreen()
    this.savePosition()
    this.onDragEnd()
  }

  // ---- Panels: grow upward if there's room, otherwise downward. The pet stays put.

  setPanel(open: boolean): PanelLayout {
    const b = this.win.getBounds()
    if (open) this.onInteract('panel')
    if (open && this.layout === 'none') {
      const area = screen.getDisplayMatching(b).workArea
      if (b.y - PANEL >= area.y) {
        this.layout = 'above'
        this.win.setBounds({ x: b.x, y: b.y - PANEL, width: WIDTH, height: COMPACT + PANEL })
      } else {
        this.layout = 'below'
        this.win.setBounds({ x: b.x, y: b.y, width: WIDTH, height: COMPACT + PANEL })
      }
    } else if (!open && this.layout !== 'none') {
      const y = this.layout === 'above' ? b.y + PANEL : b.y
      this.layout = 'none'
      this.win.setBounds({ x: b.x, y, width: WIDTH, height: COMPACT })
    }
    return this.layout
  }

  resetPosition(): void {
    const pos = this.defaultPosition()
    this.setPanel(false)
    this.win.setBounds({ ...pos, width: WIDTH, height: COMPACT })
    this.savePosition()
  }

  destroy(): void {
    this.stopCursorTracking()
    if (this.dragTimer) clearInterval(this.dragTimer)
    if (!this.win.isDestroyed()) this.win.destroy()
  }

  // ---- Internals

  /** Top-left of the compact (panel-less) window. */
  anchor(): WindowPosition {
    const [x, y] = this.win.getPosition()
    return { x, y: this.layout === 'above' ? y + PANEL : y }
  }

  savePosition(): void {
    this.settings.setWindowPosition(this.anchor())
  }

  /** The pet's centre in screen coordinates. */
  petCenter(): Point {
    const a = this.anchor()
    return { x: a.x + PET_OFFSET.x, y: a.y + PET_OFFSET.y }
  }

  /** Lets the pet's eyes follow the cursor anywhere on screen. */
  private startCursorTracking(): void {
    if (this.cursorTimer) return
    this.cursorTimer = setInterval(() => {
      if (!this.ready || this.win.isDestroyed()) return
      const c = screen.getCursorScreenPoint()
      const p = this.petCenter()
      const dx = c.x - p.x
      const dy = c.y - p.y
      if (Math.abs(dx - this.lastCursor.dx) < 3 && Math.abs(dy - this.lastCursor.dy) < 3) return
      this.lastCursor = { dx, dy }
      this.win.webContents.send(IPC.windowCursor, { dx, dy })
    }, CURSOR_POLL_MS)
  }

  private stopCursorTracking(): void {
    if (this.cursorTimer) clearInterval(this.cursorTimer)
    this.cursorTimer = null
  }

  private defaultPosition(): WindowPosition {
    const area = screen.getPrimaryDisplay().workArea
    return { x: area.x + area.width - WIDTH - 24, y: area.y + area.height - COMPACT }
  }

  /** A saved position is only reused if the pet would still be on a connected screen. */
  private validPosition(pos: WindowPosition | null): WindowPosition | null {
    if (!pos) return null
    const pet: Rectangle = { x: pos.x + WIDTH / 2 - 40, y: pos.y + COMPACT - 150, width: 80, height: 80 }
    const onScreen = screen.getAllDisplays().some((d) => intersects(d.workArea, pet))
    return onScreen ? pos : null
  }

  private clampToScreen(): void {
    const a = this.anchor()
    const { x, y } = clampAnchor(a, this.workArea())
    if (x !== a.x || y !== a.y) {
      this.win.setPosition(x, this.layout === 'above' ? y - PANEL : y)
    }
  }

  private ensureVisible(): void {
    if (this.win.isDestroyed()) return
    if (!this.validPosition(this.anchor())) {
      this.resetPosition()
    } else {
      this.clampToScreen()
    }
  }
}

function intersects(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}
