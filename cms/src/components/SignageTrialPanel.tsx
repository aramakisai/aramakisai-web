'use client'

import { DatePicker, SelectInput } from '@payloadcms/ui'
import { useEffect, useMemo, useState } from 'react'

import {
  buildTrialStartAt,
  dateToTime,
  eventDayChoices,
  formatTrialClock,
  isTodayEventDay,
  timeToDate,
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
// Payload の .btn は下マージンを持ち、flex の行が膨らむ。高さは SelectInput・DatePicker の入力欄に揃える
const noMargin = { margin: 0 } as const
const btnStyle = { margin: 0, height: 'calc(var(--base) * 2)' } as const
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
      {/* 時刻は必須なので DatePicker の クリアボタンは出さない */}
      <style>{'.signage-trial-time .date-time-picker__clear-button{display:none}'}</style>
      <strong>試験運転</strong>
      {running && <span>試験中 {clock}</span>}
      {sel && (
        <>
          <div style={{ width: 120 }}>
            <SelectInput
              name="trial-day"
              path="trial-day"
              isClearable={false}
              readOnly={saving}
              style={noMargin}
              options={choices.map((c) => ({ label: c.label, value: c.dateKey }))}
              value={sel.dateKey}
              onChange={(option) => {
                const picked = Array.isArray(option) ? option[0] : option
                const c = choices.find((x) => x.dateKey === (picked as { value?: unknown })?.value)
                if (c) setPicked({ dateKey: c.dateKey, time: c.time })
              }}
            />
          </div>
          <div className="signage-trial-time" style={{ width: 100 }}>
            <DatePicker
              pickerAppearance="timeOnly"
              timeFormat="HH:mm"
              displayFormat="HH:mm"
              timeIntervals={1}
              readOnly={saving}
              value={timeToDate(sel.time)}
              onChange={(d) => d && setPicked({ dateKey: sel.dateKey, time: dateToTime(d) })}
            />
          </div>
        </>
      )}
      <button
        type="button"
        className="btn btn--style-primary btn--size-small"
        style={btnStyle}
        disabled={blocked}
        onClick={() => sel && void start(buildTrialStartAt(sel.dateKey, sel.time))}
      >
        {running ? '開始し直す' : '開始'}
      </button>
      {running && (
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          style={btnStyle}
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
