import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'

/** Another app's window, in screen coordinates (same space as Electron's). */
export interface DesktopWindow {
  id: number
  pid: number
  owner: string
  x: number
  y: number
  width: number
  height: number
}

export interface FrontApp {
  name: string
  bundleId: string
  pid: number
}

export interface DesktopState {
  front: FrontApp | null
  /** Normal app windows, front-most first. Never includes our own windows. */
  windows: DesktopWindow[]
}

export type WatchRate = 'off' | 'slow' | 'fast'

const INTERVAL_S: Record<Exclude<WatchRate, 'off'>, number> = { slow: 1, fast: 0.1 }

/**
 * A tiny JavaScript-for-Automation loop run by the built-in `osascript`.
 * It reads window positions (CGWindowList) and the front app (NSWorkspace) –
 * neither needs a permission prompt, and window *titles* are never read.
 * It prints a JSON line whenever something changes, plus a heartbeat so it
 * dies of a broken pipe if Ori ever quits without stopping it.
 */
const SCRIPT = `
ObjC.import('CoreGraphics')
ObjC.import('AppKit')
function snapshot(ownPid) {
  const raw = $.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements, $.kCGNullWindowID)
  const list = ObjC.deepUnwrap(ObjC.castRefToObject(raw)) || []
  const windows = []
  for (const w of list) {
    if (w.kCGWindowLayer !== 0 || w.kCGWindowOwnerPID === ownPid || (w.kCGWindowAlpha ?? 1) < 0.1) continue
    const b = w.kCGWindowBounds
    if (b.Width < 120 || b.Height < 60) continue
    windows.push({ id: w.kCGWindowNumber, pid: w.kCGWindowOwnerPID, owner: w.kCGWindowOwnerName || '', x: b.X, y: b.Y, width: b.Width, height: b.Height })
  }
  const app = $.NSWorkspace.sharedWorkspace.frontmostApplication
  const front = app.isNil() ? null : { name: app.localizedName.js || '', bundleId: app.bundleIdentifier.js || '', pid: app.processIdentifier }
  return { front, windows }
}
function run(argv) {
  const interval = Number(argv[0]) || 1
  const ownPid = Number(argv[1]) || -1
  const out = $.NSFileHandle.fileHandleWithStandardOutput
  const write = (s) => out.writeData($(s + '\\n').dataUsingEncoding($.NSUTF8StringEncoding))
  let last = ''
  let quiet = 0
  while (true) {
    const s = JSON.stringify(snapshot(ownPid))
    if (s !== last) { write(s); last = s; quiet = 0 }
    else if ((quiet += interval) >= 5) { write(''); quiet = 0 }
    delay(interval)
  }
}
`

/** Keeps an up-to-date picture of the other windows on screen and the app in front (macOS). */
export class DesktopWatcher {
  private proc: ChildProcess | null = null
  private rate: WatchRate = 'off'
  private state: DesktopState = { front: null, windows: [] }
  private readonly listeners = new Set<(state: DesktopState) => void>()
  private readonly demands = new Map<string, WatchRate>()

  static get supported(): boolean {
    return process.platform === 'darwin'
  }

  current(): DesktopState {
    return this.state
  }

  onChange(listener: (state: DesktopState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Each feature says how fresh it needs the picture to be (e.g. fast while
   * riding a window, slow for app awareness); the fastest request wins.
   */
  want(who: string, rate: WatchRate): void {
    this.demands.set(who, rate)
    const order: WatchRate[] = ['off', 'slow', 'fast']
    const needed = [...this.demands.values()].reduce<WatchRate>(
      (best, r) => (order.indexOf(r) > order.indexOf(best) ? r : best),
      'off'
    )
    this.setRate(needed)
  }

  private setRate(rate: WatchRate): void {
    if (!DesktopWatcher.supported || rate === this.rate) return
    this.stop()
    this.rate = rate
    if (rate === 'off') {
      this.state = { front: null, windows: [] }
      return
    }
    const proc = spawn('osascript', ['-l', 'JavaScript', '-e', SCRIPT, String(INTERVAL_S[rate]), String(process.pid)], {
      stdio: ['ignore', 'pipe', 'ignore']
    })
    this.proc = proc
    createInterface({ input: proc.stdout! }).on('line', (line) => {
      if (!line.trim()) return
      try {
        this.state = JSON.parse(line) as DesktopState
        for (const l of this.listeners) l(this.state)
      } catch {
        // Ignore a garbled line; the next one will be complete.
      }
    })
    proc.on('exit', () => {
      if (this.proc === proc) {
        this.proc = null
        this.rate = 'off'
      }
    })
  }

  stop(): void {
    const proc = this.proc
    this.proc = null
    this.rate = 'off'
    if (proc && proc.exitCode === null) proc.kill()
  }
}
