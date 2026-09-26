import { powerMonitor } from 'electron'
import { RETURN_AFTER_MS } from '../game'

const IDLE_POLL_MS = 30_000

/**
 * Notices when the user steps away from the computer (idle, locked, asleep)
 * and when they come back, so the pet can greet them.
 */
export function watchPresence(handlers: { away(): void; returned(awayMs: number): void }): () => void {
  let awaySince: number | null = null

  const markAway = (since: number): void => {
    if (awaySince !== null) return
    awaySince = since
    handlers.away()
  }
  const markBack = (): void => {
    if (awaySince === null) return
    const awayMs = Date.now() - awaySince
    awaySince = null
    if (awayMs >= RETURN_AFTER_MS) handlers.returned(awayMs)
  }

  const onAway = (): void => markAway(Date.now())
  powerMonitor.on('lock-screen', onAway)
  powerMonitor.on('suspend', onAway)
  powerMonitor.on('unlock-screen', markBack)
  powerMonitor.on('resume', markBack)

  const timer = setInterval(() => {
    const idleMs = powerMonitor.getSystemIdleTime() * 1000
    if (idleMs >= RETURN_AFTER_MS) markAway(Date.now() - idleMs)
    else if (idleMs < IDLE_POLL_MS && awaySince !== null && powerMonitor.getSystemIdleState(60) === 'active') markBack()
  }, IDLE_POLL_MS)

  return () => {
    clearInterval(timer)
    powerMonitor.off('lock-screen', onAway)
    powerMonitor.off('suspend', onAway)
    powerMonitor.off('unlock-screen', markBack)
    powerMonitor.off('resume', markBack)
  }
}
