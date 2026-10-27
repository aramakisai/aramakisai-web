import type { ParkingDb } from './parking-db'
import { isWithinMonitorWindow } from './parking-monitor'

type WatchDb = Pick<ParkingDb, 'find' | 'findGlobal' | 'update' | 'logger'>

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const OUTAGE_AFTER_MS = 15 * 60 * 1000
const SEND_TIMEOUT_MS = 5000
const DAYS_BEFORE_EVENT = 7
const DEFAULT_MONITOR = { start: '09:00', end: '17:30' }

const jstIso = (at: Date) => new Date(at.getTime() + JST_OFFSET_MS).toISOString()
const jstDate = (at: Date) => jstIso(at).slice(0, 10)
const jstClock = (at: Date) => jstIso(at).slice(11, 16)
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS

export function warnIfWatchUnconfigured(
  warn: (message: string) => void,
  url = process.env.PARKING_CAMERA_DISCORD_WEBHOOK_URL,
): void {
  if (!url)
    warn('PARKING_CAMERA_DISCORD_WEBHOOK_URL が未設定のため、駐車場カメラの停止は通知されません')
}

function inNotifyPeriod(now: Date, eventDays: { start_at?: string }[]): boolean {
  const days = eventDays.flatMap((d) =>
    d.start_at ? [dayNumber(jstDate(new Date(d.start_at)))] : [],
  )
  if (days.length === 0) return false
  const today = dayNumber(jstDate(now))
  return today >= Math.min(...days) - DAYS_BEFORE_EVENT && today <= Math.max(...days)
}

function buildMessage(
  heading: string,
  camera: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
): string {
  const last = camera.last_captured_at ? new Date(camera.last_captured_at) : null
  const lastText = last
    ? `${Number(jstIso(last).slice(5, 7))}/${Number(jstIso(last).slice(8, 10))} ${jstClock(last)}`
    : 'なし'
  const ds = camera.device_status as Record<string, any> | null | undefined // eslint-disable-line @typescript-eslint/no-explicit-any
  const statusLine = ds?.received_at
    ? `端末状態(${jstClock(new Date(ds.received_at))}時点): 電波 ${
        typeof ds.rssi === 'number' ? `${ds.rssi}dBm` : '不明'
      } / 送信失敗 ${typeof ds.failures === 'number' ? `${ds.failures}回` : '不明'} / 再起動理由 ${
        ds.reset_reason ?? '不明'
      }`
    : '端末状態: 未受信'
  const lot = camera.lot && typeof camera.lot === 'object' ? camera.lot.name : '不明'
  return [
    heading,
    `カメラ: ${camera.name}`,
    `割り当て先: ${lot}`,
    `最後の撮影: ${lastText}`,
    statusLine,
  ].join('\n')
}

async function send(
  url: string,
  content: string,
  fetchImpl: typeof fetch,
  payload: WatchDb,
): Promise<boolean> {
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    if (res.ok) return true
    payload.logger.warn(`parking-camera-watch: Discord への送信が失敗しました status=${res.status}`)
  } catch (err) {
    payload.logger.warn(`parking-camera-watch: Discord への送信が失敗しました ${String(err)}`)
  }
  return false
}

interface CheckArgs {
  readonly payload: WatchDb
  readonly now: Date
  readonly webhookUrl: string | undefined
  readonly fetchImpl: typeof fetch
}

export async function checkParkingCameras({
  payload,
  now,
  webhookUrl,
  fetchImpl,
}: CheckArgs): Promise<void> {
  if (!webhookUrl) return
  const settings = await payload.findGlobal({
    slug: 'site_settings',
    depth: 0,
    overrideAccess: true,
  })
  const monitor = { ...DEFAULT_MONITOR, ...(settings.parking_monitor ?? {}) }
  if (!inNotifyPeriod(now, settings.event_days ?? []) || !isWithinMonitorWindow(now, monitor))
    return

  const { docs } = await payload.find({
    collection: 'parking_cameras',
    where: { lot: { exists: true } },
    depth: 1,
    pagination: false,
    overrideAccess: true,
  })
  const todayStart = Date.parse(`${jstDate(now)}T${monitor.start}:00+09:00`)

  for (const camera of docs) {
    const last = camera.last_captured_at ? Date.parse(camera.last_captured_at) : null
    const notified = camera.outage_notified_at ? Date.parse(camera.outage_notified_at) : null

    if (notified === null) {
      // 前日の最後の画像や監視開始前の時間で、開始直後に停止と誤判定しない
      const base = Math.max(last ?? 0, todayStart)
      if (now.getTime() - base < OUTAGE_AFTER_MS) continue
      if (
        await send(
          webhookUrl,
          buildMessage('駐車場カメラの画像が届いていません', camera),
          fetchImpl,
          payload,
        )
      ) {
        await payload.update({
          collection: 'parking_cameras',
          id: camera.id,
          data: { outage_notified_at: now.toISOString() },
          overrideAccess: true,
        })
      }
    } else if (last !== null && last > notified) {
      if (
        await send(
          webhookUrl,
          buildMessage('駐車場カメラの画像の受信が再開しました', camera),
          fetchImpl,
          payload,
        )
      ) {
        await payload.update({
          collection: 'parking_cameras',
          id: camera.id,
          data: { outage_notified_at: null },
          overrideAccess: true,
        })
      }
    }
  }
}
