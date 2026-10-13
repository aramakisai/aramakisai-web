import { describe, expect, it, vi } from 'vitest'

import type { QuakeRelayStatus } from '../lib/signage-quake-relay'
import {
  discordNotice,
  dismissQuake,
  fetchQuakeStatus,
  formatMonthDayTime,
  periodText,
} from './signage-quake'

const discord = (o: Partial<QuakeRelayStatus['discord']>): QuakeRelayStatus['discord'] => ({
  configured: true,
  disabled: false,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailure: null,
  ...o,
})
const res = (ok: boolean, body: unknown) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body } as Response)

describe('時刻の表示', () => {
  it('日本時間で月/日 時:分にする', () => {
    expect(formatMonthDayTime('2026-10-23T00:00:00Z')).toBe('10/23 9:00')
    expect(periodText({ from: '2026-10-23T00:00:00Z', until: '2026-11-21T15:00:00Z' })).toBe(
      '稼働期間: 10/23 9:00〜11/22 0:00',
    )
  })
})

describe('discordNotice', () => {
  it('未設定・停止中・直近が失敗・正常を区別する', () => {
    expect(discordNotice(discord({ configured: false }))).toBe('Discord通知: 未設定')
    expect(discordNotice(discord({ disabled: true }))).toBe(
      'Discord通知: 停止中(Webhookを確かめてください)',
    )
    expect(
      discordNotice(
        discord({ lastSuccessAt: '2026-10-23T00:00:00Z', lastFailureAt: '2026-10-23T01:00:00Z' }),
      ),
    ).toBe('Discord通知に失敗(10/23 10:00:00)')
    expect(
      discordNotice(
        discord({ lastSuccessAt: '2026-10-23T02:00:00Z', lastFailureAt: '2026-10-23T01:00:00Z' }),
      ),
    ).toBeNull()
  })
})

describe('取得と解除', () => {
  it('成功は状態を返す', async () => {
    expect(await fetchQuakeStatus(res(true, { inPeriod: true }))).toEqual({
      status: { inPeriod: true },
    })
  })
  it('503 not_configured は未設定、それ以外の失敗・例外は届かない', async () => {
    expect(await fetchQuakeStatus(res(false, { error: 'not_configured' }))).toEqual({
      error: 'not_configured',
    })
    expect(await fetchQuakeStatus(res(false, { error: 'relay_unreachable' }))).toEqual({
      error: 'unreachable',
    })
    expect(await dismissQuake(vi.fn().mockRejectedValue(new Error('x')))).toEqual({
      error: 'unreachable',
    })
  })
  it('解除はPOSTで本文なし', async () => {
    const f = res(true, {})
    await dismissQuake(f)
    expect(f).toHaveBeenCalledWith('/api/signage-quake/dismiss', {
      method: 'POST',
      credentials: 'include',
    })
  })
})
