import type { Candle, Time } from '~/types/market'

// Market sessions are a *non-mathematical* indicator: they depend only on the
// clock, not on price. Hours are in UTC and (deliberately) none cross midnight,
// which keeps membership a simple range check. Translucent fills stack, so
// overlaps (e.g. London↔New York, 13–16 UTC) naturally read as hotter zones.

export interface SessionDef {
  id: string
  name: string
  short: string
  /** Inclusive UTC open hour. */
  openHour: number
  /** Exclusive UTC close hour. */
  closeHour: number
  /** Background fill drawn behind the candles. */
  fill: string
  /** Solid accent used for the recap chip. */
  accent: string
}

export const SESSIONS: SessionDef[] = [
  {
    id: 'asia',
    name: 'Asie · Tokyo',
    short: 'ASIE',
    openHour: 0,
    closeHour: 9,
    fill: 'rgba(56,189,248,0.06)',
    accent: '#38bdf8',
  },
  {
    id: 'london',
    name: 'Europe · Londres',
    short: 'LDN',
    openHour: 7,
    closeHour: 16,
    fill: 'rgba(168,85,247,0.06)',
    accent: '#a855f7',
  },
  {
    id: 'newyork',
    name: 'US · New York',
    short: 'NY',
    openHour: 13,
    closeHour: 22,
    fill: 'rgba(34,197,94,0.07)',
    accent: '#22c55e',
  },
]

/** Fractional UTC hour for a unix-seconds timestamp. */
export function utcHour(time: Time): number {
  return ((time % 86400) + 86400) % 86400 / 3600
}

export function isOpenAt(session: SessionDef, time: Time): boolean {
  const h = utcHour(time)
  return h >= session.openHour && h < session.closeHour
}

export interface SessionSegment {
  session: SessionDef
  start: Time
  end: Time
}

/** Contiguous runs of candles that fall inside each session — for chart bands. */
export function computeSessionSegments(candles: Candle[]): SessionSegment[] {
  const segments: SessionSegment[] = []
  for (const session of SESSIONS) {
    let runStart: Time | null = null
    let prev: Time | null = null
    for (const c of candles) {
      if (isOpenAt(session, c.time)) {
        if (runStart === null) runStart = c.time
        prev = c.time
      } else if (runStart !== null) {
        segments.push({ session, start: runStart, end: prev! })
        runStart = null
      }
    }
    if (runStart !== null) segments.push({ session, start: runStart, end: prev! })
  }
  return segments
}

export interface SessionStatus {
  session: SessionDef
  open: boolean
  /** Minutes until the next open (if closed) or close (if open). */
  minutesToChange: number
}

export function sessionStatuses(time: Time): SessionStatus[] {
  const h = utcHour(time)
  return SESSIONS.map((session) => {
    const open = isOpenAt(session, time)
    const target = open ? session.closeHour : nextOpenHour(session, h)
    let diff = target - h
    if (diff < 0) diff += 24
    return { session, open, minutesToChange: Math.round(diff * 60) }
  })
}

function nextOpenHour(session: SessionDef, h: number): number {
  return h < session.openHour ? session.openHour : session.openHour + 24
}
