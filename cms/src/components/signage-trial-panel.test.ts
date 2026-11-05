import { describe, expect, it } from 'vitest'

import {
  buildTrialStartAt,
  dateToTime,
  eventDayChoices,
  formatTrialClock,
  isTodayEventDay,
  timeToDate,
} from './signage-trial-panel'

const days = [
  { start_at: '2026-11-08T00:30:00.000Z', label: '1日目' }, // JST 09:30
  { start_at: '2026-11-07T00:00:00.000Z' }, // JST 09:00, ラベルなし
]

describe('eventDayChoices', () => {
  it('日付順に並べ、ラベルが無ければ M/D(曜)、時刻は開場の JST 時:分', () => {
    expect(eventDayChoices(days)).toEqual([
      { dateKey: '2026-11-07', label: '11/7(土)', time: '09:00' },
      { dateKey: '2026-11-08', label: '1日目', time: '09:30' },
    ])
  })
  it('start_at の無い行は捨てる', () => {
    expect(eventDayChoices([{ label: 'x' }])).toEqual([])
  })
})

describe('buildTrialStartAt', () => {
  it('操作 PC のタイムゾーンによらず +09:00 付きで組み立てる', () => {
    expect(buildTrialStartAt('2026-11-07', '09:05')).toBe('2026-11-07T09:05:00+09:00')
  })
})

describe('formatTrialClock', () => {
  it('start_at + (now - anchored_at) を JST の M/D HH:MM にする', () => {
    const trial = { start_at: '2026-11-07T09:00:00+09:00', anchored_at: '2026-10-01T00:00:00.000Z' }
    const now = Date.parse('2026-10-01T00:00:00.000Z') + 61 * 60 * 1000
    expect(formatTrialClock(trial, now)).toBe('11/7 10:01')
  })
  it('未設定なら null', () => {
    expect(formatTrialClock({ start_at: null, anchored_at: null }, 0)).toBeNull()
  })
})

describe('isTodayEventDay', () => {
  it('現実の JST 日付が開催日なら true', () => {
    expect(isTodayEventDay(days, Date.parse('2026-11-07T16:00:00Z'))).toBe(true) // JST 11/8 01:00
    expect(isTodayEventDay(days, Date.parse('2026-11-06T14:00:00Z'))).toBe(false) // JST 11/6 23:00
  })
})

describe('timeToDate / dateToTime', () => {
  it('HH:mm を Date の時・分に往復変換する', () => {
    const d = timeToDate('10:37')
    expect([d.getHours(), d.getMinutes()]).toEqual([10, 37])
    expect(dateToTime(d)).toBe('10:37')
    expect(dateToTime(timeToDate('00:05'))).toBe('00:05')
  })
})
