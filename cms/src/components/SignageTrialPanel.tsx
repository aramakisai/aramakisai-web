'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  buildTrialStartAt,
  eventDayChoices,
  formatTrialClock,
  isTodayEventDay,
} from './signage-trial-panel'
import { useEventDays } from './useEventDays'
import { useSignageTrial } from './useSignageTrial'

const box = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--base)',
  padding: 'calc(var(--base) / 2) var(--base)',
  marginBottom: 'var(--base)',
  background: 'var(--theme-elevation-100)',
  borderRadius: 'var(--style-radius-s)',
} as const
// Payload の .btn は下マージンを持ち、flex の行が膨らむ
const noMargin = { margin: 0 } as const
const error = { color: 'var(--theme-error-500)' } as const

export default function SignageTrialPanel() {
  const { trial, saving, failed, start, stop } = useSignageTrial()
  const eventDays = useEventDays()
  const choices = useMemo(() => eventDayChoices(eventDays ?? []), [eventDays])
  const [picked, setPicked] = useState<{ dateKey: string; time: string } | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!trial || !eventDays) return null

  const sel = picked ?? (choices[0] ? { dateKey: choices[0].dateKey, time: choices[0].time } : null)
  const running = trial.start_at !== null
  // 開始直後は tick が開始前の時刻のままなので、起点より前には戻さない
  const clock = formatTrialClock(trial, Math.max(nowMs, Date.parse(trial.anchored_at ?? '') || 0))
  const noDays = choices.length === 0
  const eventToday = isTodayEventDay(eventDays, nowMs)
  const blocked = saving || noDays || eventToday || !sel

  return (
    <div style={box}>
      <strong>試験運転</strong>
      {running && <span>試験中 {clock}</span>}
      {sel && (
        <>
          <select
            value={sel.dateKey}
            disabled={saving}
            onChange={(e) => {
              const c = choices.find((x) => x.dateKey === e.target.value)
              if (c) setPicked({ dateKey: c.dateKey, time: c.time })
            }}
          >
            {choices.map((c) => (
              <option key={c.dateKey} value={c.dateKey}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="time"
            step={60}
            value={sel.time}
            disabled={saving}
            onChange={(e) =>
              e.target.value && setPicked({ dateKey: sel.dateKey, time: e.target.value })
            }
          />
        </>
      )}
      <button
        type="button"
        className="btn btn--style-primary btn--size-small"
        style={noMargin}
        disabled={blocked}
        onClick={() => sel && void start(buildTrialStartAt(sel.dateKey, sel.time))}
      >
        {running ? '開始し直す' : '開始'}
      </button>
      {running && (
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          style={noMargin}
          disabled={saving}
          onClick={() => void stop()}
        >
          終了
        </button>
      )}
      {noDays && <span style={error}>開催日程が未登録です</span>}
      {eventToday && <span style={error}>開催日のため試験運転は無効です</span>}
      {failed && <span style={error}>保存できませんでした</span>}
    </div>
  )
}
