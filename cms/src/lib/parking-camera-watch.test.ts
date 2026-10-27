import { describe, expect, it, vi } from 'vitest'

import { checkParkingCameras, warnIfWatchUnconfigured } from './parking-camera-watch'

type Args = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const jst = (s: string) => new Date(`${s.replace(' ', 'T')}:00+09:00`)
const DAY = '2026-10-17'
const URL = 'https://discord.example/webhook'

function setup(
  camera: Record<string, unknown> = {},
  opts: {
    eventDays?: string[]
    monitor?: { start: string; end: string }
    send?: 'ok' | 'fail'
  } = {},
) {
  const doc = {
    id: 3,
    name: '4階東側',
    lot: { id: 11, name: '第2グラウンド' },
    last_captured_at: null,
    outage_notified_at: null,
    device_status: null,
    ...camera,
  }
  const payload = {
    find: vi.fn(async (args: Args) => ({
      docs: JSON.stringify(args.where).includes('exists') ? [doc] : [],
    })),
    findGlobal: vi.fn().mockResolvedValue({
      event_days: (opts.eventDays ?? [DAY]).map((d) => ({ start_at: `${d}T10:00:00+09:00` })),
      parking_monitor: opts.monitor ?? { start: '09:00', end: '17:30' },
    }),
    update: vi.fn().mockResolvedValue({}),
    logger: { warn: vi.fn() },
  }
  const fetchImpl = vi.fn(
    async () => new Response(null, { status: opts.send === 'fail' ? 500 : 204 }),
  )
  return { payload, fetchImpl }
}

async function check(at: string, s: ReturnType<typeof setup>, webhookUrl: string | null = URL) {
  await checkParkingCameras({
    payload: s.payload,
    now: jst(at),
    webhookUrl: webhookUrl ?? undefined,
    fetchImpl: s.fetchImpl as unknown as typeof fetch,
  })
}
const sent = (s: ReturnType<typeof setup>) =>
  s.fetchImpl.mock.calls.map(
    (c) => JSON.parse(((c as unknown[])[1] as RequestInit).body as string).content as string,
  )
const updated = (s: ReturnType<typeof setup>) =>
  s.payload.update.mock.calls.map((c) => (c[0] as Args).data)

describe('停止の通知', () => {
  it('当日の画像なしで 9:14 は通知せず 9:15 で停止を送り、印を書く', async () => {
    const a = setup()
    await check(`${DAY} 09:14`, a)
    expect(sent(a)).toEqual([])
    const b = setup()
    await check(`${DAY} 09:15`, b)
    expect(sent(b)[0]).toMatch(/^駐車場カメラの画像が届いていません/)
    expect(updated(b)).toEqual([{ outage_notified_at: jst(`${DAY} 09:15`).toISOString() }])
  })

  it('前日の最後の画像は基準にならない', async () => {
    const s = setup({ last_captured_at: jst('2026-10-16 17:30').toISOString() })
    await check(`${DAY} 09:14`, s)
    expect(sent(s)).toEqual([])
  })

  it('最後の撮影 10:00 なら 10:14 は通知せず 10:15 で停止', async () => {
    const last = jst(`${DAY} 10:00`).toISOString()
    const a = setup({ last_captured_at: last })
    await check(`${DAY} 10:14`, a)
    expect(sent(a)).toEqual([])
    const b = setup({ last_captured_at: last })
    await check(`${DAY} 10:15`, b)
    expect(sent(b)).toHaveLength(1)
  })

  it('通知済みなら 10:16 に再送しない', async () => {
    const s = setup({
      last_captured_at: jst(`${DAY} 10:00`).toISOString(),
      outage_notified_at: jst(`${DAY} 10:15`).toISOString(),
    })
    await check(`${DAY} 10:16`, s)
    expect(sent(s)).toEqual([])
    expect(s.payload.update).not.toHaveBeenCalled()
  })

  it('送信に失敗したら印を書かず、次の実行で送り直す', async () => {
    const last = jst(`${DAY} 10:00`).toISOString()
    const s = setup({ last_captured_at: last }, { send: 'fail' })
    await check(`${DAY} 10:15`, s)
    expect(s.payload.update).not.toHaveBeenCalled()
    await check(`${DAY} 10:16`, s)
    expect(sent(s)).toHaveLength(2)
  })

  it('送信は 5 秒の打ち切りと allowed_mentions の空指定を付ける', async () => {
    const s = setup()
    await check(`${DAY} 09:15`, s)
    const [url, init] = s.fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(URL)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(init.body as string).allowed_mentions).toEqual({ parse: [] })
  })
})

describe('復旧の通知', () => {
  it('通知後に新しい撮影が届いたら復旧を 1 回送って印を消す', async () => {
    const s = setup({
      last_captured_at: jst(`${DAY} 10:20`).toISOString(),
      outage_notified_at: jst(`${DAY} 10:15`).toISOString(),
    })
    await check(`${DAY} 10:21`, s)
    expect(sent(s)).toHaveLength(1)
    expect(sent(s)[0]).toMatch(/^駐車場カメラの画像の受信が再開しました\n/)
    expect(sent(s)[0]).toContain('最後の撮影: 10/17 10:20')
    expect(updated(s)).toEqual([{ outage_notified_at: null }])
  })

  it('復旧の送信に失敗したら印を残す', async () => {
    const s = setup(
      {
        last_captured_at: jst(`${DAY} 10:20`).toISOString(),
        outage_notified_at: jst(`${DAY} 10:15`).toISOString(),
      },
      { send: 'fail' },
    )
    await check(`${DAY} 10:21`, s)
    expect(s.payload.update).not.toHaveBeenCalled()
  })
})

describe('通知しない条件', () => {
  it('17:31 以降は通知しない', async () => {
    const s = setup({ last_captured_at: jst(`${DAY} 10:00`).toISOString() })
    await check(`${DAY} 17:31`, s)
    expect(s.fetchImpl).not.toHaveBeenCalled()
  })

  it('監視時間の設定に従う', async () => {
    const s = setup({}, { monitor: { start: '10:00', end: '12:00' } })
    await check(`${DAY} 09:30`, s)
    await check(`${DAY} 12:01`, s)
    expect(s.fetchImpl).not.toHaveBeenCalled()
  })

  it('未割り当てのカメラは対象にしない', async () => {
    const s = setup()
    await check(`${DAY} 09:15`, s)
    expect(JSON.stringify(s.payload.find.mock.calls[0][0].where)).toContain('exists')
    s.payload.find.mockResolvedValue({ docs: [] })
    s.fetchImpl.mockClear()
    await check(`${DAY} 09:15`, s)
    expect(s.fetchImpl).not.toHaveBeenCalled()
  })

  it('Webhook URL が無ければ何も読まない', async () => {
    const s = setup()
    await check(`${DAY} 09:15`, s, null)
    expect(s.payload.findGlobal).not.toHaveBeenCalled()
    expect(s.fetchImpl).not.toHaveBeenCalled()
  })

  it('対象期間: 開催初日の 7 日前は対象、8 日前は対象外', async () => {
    const a = setup()
    await check('2026-10-10 09:15', a)
    expect(sent(a)).toHaveLength(1)
    const b = setup()
    await check('2026-10-09 09:15', b)
    expect(sent(b)).toEqual([])
  })

  it('対象期間: 最終日は対象、翌日は対象外', async () => {
    const days = ['2026-10-17', '2026-10-18']
    const a = setup({}, { eventDays: days })
    await check('2026-10-18 09:15', a)
    expect(sent(a)).toHaveLength(1)
    const b = setup({}, { eventDays: days })
    await check('2026-10-19 09:15', b)
    expect(sent(b)).toEqual([])
  })

  it('開催日が空なら対象外', async () => {
    const s = setup({}, { eventDays: [] })
    await check(`${DAY} 09:15`, s)
    expect(s.fetchImpl).not.toHaveBeenCalled()
  })
})

describe('本文', () => {
  it('名前・割り当て先・最後の撮影・端末状態が入る', async () => {
    const s = setup({
      last_captured_at: jst(`${DAY} 10:00`).toISOString(),
      device_status: {
        rssi: -72,
        failures: 4,
        reset_reason: 'TASK_WDT',
        received_at: jst(`${DAY} 10:00`).toISOString(),
      },
    })
    await check(`${DAY} 10:15`, s)
    expect(sent(s)[0]).toBe(
      [
        '駐車場カメラの画像が届いていません',
        'カメラ: 4階東側',
        '割り当て先: 第2グラウンド',
        '最後の撮影: 10/17 10:00',
        '端末状態(10:00時点): 電波 -72dBm / 送信失敗 4回 / 再起動理由 TASK_WDT',
      ].join('\n'),
    )
  })

  it('値の無い項目は「不明」、撮影が無ければ「なし」、端末状態が無ければ「未受信」', async () => {
    const a = setup({
      device_status: {
        rssi: null,
        failures: null,
        reset_reason: null,
        received_at: jst(`${DAY} 09:00`).toISOString(),
      },
    })
    await check(`${DAY} 09:15`, a)
    expect(sent(a)[0]).toContain('最後の撮影: なし')
    expect(sent(a)[0]).toContain('端末状態(09:00時点): 電波 不明 / 送信失敗 不明 / 再起動理由 不明')
    const b = setup()
    await check(`${DAY} 09:15`, b)
    expect(sent(b)[0]).toContain('端末状態: 未受信')
  })
})

describe('起動時の警告', () => {
  it('Webhook URL が未設定のときだけ警告する', () => {
    const warn = vi.fn()
    warnIfWatchUnconfigured(warn, 'https://x')
    expect(warn).not.toHaveBeenCalled()
    warnIfWatchUnconfigured(warn, undefined)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
