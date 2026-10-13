import type { QuakeChannelName, QuakeRelayStatus, QuakeStage } from '../lib/signage-quake-relay'

export type QuakeLoadError = 'not_configured' | 'unreachable'
export type QuakeFetchResult = { status: QuakeRelayStatus } | { error: QuakeLoadError }

export const CHANNEL_LABELS: Record<QuakeChannelName, string> = {
  p2p: 'P2P地震情報(警報)',
  wolfxEew: 'Wolfx(緊急地震速報)',
  wolfxEqlist: 'Wolfx(地震情報)',
}

export const STAGE_LABELS: Record<QuakeStage, string> = {
  warning: '段階1(警報)',
  calm: '段階2(揺れが収まった)',
  evacuate: '段階3(避難)',
  cancelled: '取消',
}

// 表示は日本時間に固定する。閲覧者のタイムゾーンで運用者の読み方が変わらないようにする
function jst(iso: string): Date | null {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : new Date(t + 9 * 3_600_000)
}

export function formatMonthDayTime(iso: string): string {
  const d = jst(iso)
  return d
    ? `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    : '-'
}

export function formatTime(iso: string | null): string {
  const d = iso ? jst(iso) : null
  if (!d) return '受信なし'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

export const periodText = (p: QuakeRelayStatus['period']) =>
  `稼働期間: ${formatMonthDayTime(p.from)}〜${formatMonthDayTime(p.until)}`

/** 通知の状態。正常なら null */
export function discordNotice(d: QuakeRelayStatus['discord']): string | null {
  if (!d.configured) return 'Discord通知: 未設定'
  if (d.disabled) return 'Discord通知: 停止中(Webhookを確かめてください)'
  if (
    d.lastFailureAt &&
    (!d.lastSuccessAt || Date.parse(d.lastFailureAt) > Date.parse(d.lastSuccessAt))
  ) {
    return `Discord通知に失敗(${formatTime(d.lastFailureAt)})`
  }
  return null
}

export async function fetchQuakeStatus(f: typeof fetch = fetch): Promise<QuakeFetchResult> {
  return request('/api/signage-quake', 'GET', f)
}

export async function dismissQuake(f: typeof fetch = fetch): Promise<QuakeFetchResult> {
  return request('/api/signage-quake/dismiss', 'POST', f)
}

async function request(url: string, method: string, f: typeof fetch): Promise<QuakeFetchResult> {
  try {
    const res = await f(url, { method, credentials: 'include' })
    if (res.ok) return { status: (await res.json()) as QuakeRelayStatus }
    const body = await res.json().catch(() => null)
    return { error: body?.error === 'not_configured' ? 'not_configured' : 'unreachable' }
  } catch {
    return { error: 'unreachable' }
  }
}
