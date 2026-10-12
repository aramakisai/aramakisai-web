import net from 'node:net'

import pg from 'pg'

import { optionalEnv } from '../env'

const PROBE_TIMEOUT_MS = 3000

function canConnect(url: URL, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: url.hostname, port: Number(url.port) || 5432 })
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

/**
 * 読み取りレプリカの接続先を返す。未設定、または起動時に到達できなければ undefined。
 *
 * @payloadcms/db-postgres はレプリカへの初回接続を `void` で投げ捨てるため、起動時に
 * 到達できないと unhandled rejection で Node ごと落ちる。落ちるくらいなら primary のみで
 * 起動したいので、先に TCP 疎通を確かめて到達不能なら readReplicas を付けない。
 * 起動後にレプリカが落ちた場合はフォールバックしない (読み取りがエラーになる)。
 */
export async function resolveReadReplicaUrl(
  url: string | undefined = optionalEnv('DATABASE_REPLICA_URL'),
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<string | undefined> {
  if (!url) return undefined
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    console.warn('DATABASE_REPLICA_URL が URL として不正。読み取りレプリカを使わず起動する')
    return undefined
  }
  if (await canConnect(parsed, timeoutMs)) return url
  console.warn(
    `読み取りレプリカ ${parsed.hostname}:${parsed.port || 5432} に到達できない。primary のみで起動する`,
  )
  return undefined
}

const PRIMARY_POOL_MAX = 5
const REPLICA_POOL_MAX = 10

/**
 * @payloadcms/db-postgres はレプリカ用 Pool を primary の pool 設定 (max 含む) の
 * コピーで作るため、primary だけ絞るには Pool 生成時に接続先で max を振り分ける。
 * primary は書き込み中心で接続数が少なくて済む。
 */
export function createPgWithPoolErrorHandler(primaryUrl: string): typeof pg {
  // アイドル接続が切れると pg の Pool は 'error' を emit する。リスナーが無いと未捕捉例外で
  // Node が落ちる。@payloadcms/db-postgres はレプリカ側の Pool にリスナーを付けないため、
  // レプリカの再起動やフェイルオーバーのたびに CMS が落ちる。Pool 生成時に必ず付ける。
  // 切れた接続は Pool が破棄し、次のクエリが張り直す。
  class ErrorHandledPool extends pg.Pool {
    constructor(options?: pg.PoolConfig) {
      super({
        ...options,
        max: options?.connectionString === primaryUrl ? PRIMARY_POOL_MAX : REPLICA_POOL_MAX,
      })
      this.on('error', (err) => {
        console.error(`Postgres のアイドル接続でエラー: ${err.message}`)
      })
    }
  }
  return { ...pg, Pool: ErrorHandledPool }
}
