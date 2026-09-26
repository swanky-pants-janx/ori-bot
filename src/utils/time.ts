export const SECOND = 1000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** "6 hours", "2 days", "a few minutes" – for dialogue and AI context. */
export function describeDuration(ms: number): string {
  if (ms < 2 * MINUTE) return 'a moment'
  if (ms < 15 * MINUTE) return 'a few minutes'
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} minutes`
  if (ms < 1.5 * HOUR) return 'about an hour'
  if (ms < DAY) return `${Math.round(ms / HOUR)} hours`
  if (ms < 1.5 * DAY) return 'about a day'
  return `${Math.round(ms / DAY)} days`
}
