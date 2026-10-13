'use client'

import {
  CHANNEL_LABELS,
  discordNotice,
  formatTime,
  periodText,
  STAGE_LABELS,
} from './signage-quake'
import { useSignageQuake } from './useSignageQuake'

const box = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'calc(var(--base) / 2)',
  padding: 'calc(var(--base) / 2) var(--base)',
  marginBottom: 'var(--base)',
  background: 'var(--theme-elevation-100)',
  borderRadius: 'var(--style-radius-s)',
} as const
const error = { color: 'var(--theme-error-500)', fontWeight: 600 } as const

export default function SignageQuakePanel() {
  const { result, saving, failed, dismiss } = useSignageQuake()
  if (!result) return null

  if ('error' in result) {
    return (
      <div style={box}>
        <span style={error}>
          {result.error === 'not_configured'
            ? '緊急地震速報: 未設定(SIGNAGE_QUAKE_URL / SIGNAGE_QUAKE_TOKEN)'
            : '緊急地震速報のリレーに届きません'}
        </span>
      </div>
    )
  }

  const s = result.status
  const alert = s.alert
  const discord = discordNotice(s.discord)

  const onDismiss = () => {
    if (window.confirm('緊急地震速報の表示を解除します。よろしいですか?')) void dismiss()
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--base)' }}>
        <strong>
          {alert.active
            ? `緊急地震速報: 表示中 ${STAGE_LABELS[alert.stage]}${alert.training ? '(訓練)' : ''}`
            : '緊急地震速報: 表示なし'}
        </strong>
        {alert.active && (
          <button
            type="button"
            className="btn btn--style-secondary btn--size-small"
            disabled={saving}
            onClick={onDismiss}
          >
            解除
          </button>
        )}
        {failed && <span style={{ color: 'var(--theme-error-500)' }}>解除できませんでした</span>}
      </div>
      {alert.active && (
        <span>
          表示開始 {formatTime(alert.startedAt)} / 最終更新 {formatTime(alert.updatedAt)}
        </span>
      )}
      {!s.inPeriod && <span>停止中({periodText(s.period)})</span>}
      {s.inPeriod && s.unreachable && <span style={error}>緊急地震速報を受信できていません</span>}
      {s.inPeriod && (
        <ul style={{ margin: 0, paddingLeft: 'var(--base)' }}>
          {(Object.keys(CHANNEL_LABELS) as (keyof typeof CHANNEL_LABELS)[]).map((k) => {
            const c = s.channels[k]
            return (
              <li key={k} style={c.receiving ? undefined : { color: 'var(--theme-error-500)' }}>
                {CHANNEL_LABELS[k]}: {c.connected ? '接続中' : '未接続'} / 最終受信{' '}
                {formatTime(c.lastReceivedAt)}
                {c.test ? ' / 試験モード' : ''}
              </li>
            )
          })}
        </ul>
      )}
      {discord && (
        <span style={discord.startsWith('Discord通知: 未設定') ? undefined : error}>{discord}</span>
      )}
    </div>
  )
}
