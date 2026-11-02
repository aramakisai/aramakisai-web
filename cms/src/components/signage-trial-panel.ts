import { toJstDateKey, toJstMinuteOfDay } from '../hooks/constraints'
import type { TrialRunValue } from '../lib/signage-trial'
import type { EventDay } from './event-day-options'

export interface EventDayChoice {
  readonly dateKey: string
  readonly label: string
  /** その日の開場時刻 (JST HH:MM)。 */
  readonly time: string
}

const WEEKDAYS = '日月火水木金土'
const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

export function eventDayChoices(days: readonly EventDay[]): EventDayChoice[] {
  return days
    .flatMap((d) => {
      const dateKey = toJstDateKey(d.start_at)
      const minute = toJstMinuteOfDay(d.start_at)
      if (!dateKey || minute === null) return []
      const [, m, day] = dateKey.split('-').map(Number)
      const wd = WEEKDAYS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()]
      const label = typeof d.label === 'string' && d.label ? d.label : `${m}/${day}(${wd})`
      return [{ dateKey, label, time: `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}` }]
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

// 操作 PC のタイムゾーンに依存させないため、オフセットを文字列で固定する
export const buildTrialStartAt = (dateKey: string, time: string) => `${dateKey}T${time}:00+09:00`

/** 現在の試験時刻 'M/D HH:MM' (JST)。試験中でなければ null。 */
export function formatTrialClock(trial: TrialRunValue, nowMs: number): string | null {
  if (!trial.start_at || !trial.anchored_at) return null
  const t = new Date(
    Date.parse(trial.start_at) + nowMs - Date.parse(trial.anchored_at) + JST_OFFSET_MS,
  )
  return `${t.getUTCMonth() + 1}/${t.getUTCDate()} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`
}

export function isTodayEventDay(days: readonly EventDay[], nowMs: number): boolean {
  const today = toJstDateKey(new Date(nowMs).toISOString())
  return days.some((d) => toJstDateKey(d.start_at) === today)
}
