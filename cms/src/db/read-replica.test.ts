import net from 'node:net'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPgWithPoolErrorHandler, resolveReadReplicaUrl } from './read-replica'

describe('resolveReadReplicaUrl', () => {
  it('未設定なら undefined', async () => {
    expect(await resolveReadReplicaUrl(undefined)).toBeUndefined()
  })

  it('URL として不正なら undefined', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await resolveReadReplicaUrl('not a url')).toBeUndefined()
  })

  it('到達できなければ undefined (起動を落とさない)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await resolveReadReplicaUrl('postgres://x:y@127.0.0.1:1/payload')).toBeUndefined()
  })

  it('到達できればそのまま返す', async () => {
    const server = net.createServer((s) => s.destroy())
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const { port } = server.address() as net.AddressInfo
    const url = `postgres://x:y@127.0.0.1:${port}/payload`
    try {
      expect(await resolveReadReplicaUrl(url)).toBe(url)
    } finally {
      server.close()
    }
  })
})

describe('createPgWithPoolErrorHandler', () => {
  const primary = 'postgres://x:y@127.0.0.1:1/p'
  const replica = 'postgres://x:y@127.0.0.1:2/p'
  afterEach(() => vi.restoreAllMocks())

  it('Pool の error イベントで落ちない', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const pool = new (createPgWithPoolErrorHandler(primary).Pool)({ connectionString: primary })
    expect(() => pool.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow()
    await pool.end()
  })

  it('primary は max 5、レプリカは max 10', async () => {
    const { Pool } = createPgWithPoolErrorHandler(primary)
    const p = new Pool({ connectionString: primary, max: 5 })
    const r = new Pool({ connectionString: replica, max: 5 })
    expect([p.options.max, r.options.max]).toEqual([5, 10])
    await Promise.all([p.end(), r.end()])
  })
})

describe('payload.config の readReplicas', () => {
  const load = async (replicaUrl: string) => {
    vi.resetModules()
    vi.stubEnv('DATABASE_URL', 'postgres://payload:payload@127.0.0.1:5433/payload')
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
    vi.stubEnv('DATABASE_REPLICA_URL', replicaUrl)
    const mod = await import('../payload.config')
    const { db } = await mod.default
    // init は adapter を組み立てるだけで接続はしない
    return (
      db as unknown as { init: (a: { payload: object }) => { readReplicaOptions?: string[] } }
    ).init({ payload: {} })
  }

  afterEach(() => vi.unstubAllEnvs())

  it('到達できるレプリカがあれば readReplicas を渡す', async () => {
    const server = net.createServer((s) => s.destroy())
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const { port } = server.address() as net.AddressInfo
    const url = `postgres://x:y@127.0.0.1:${port}/payload`
    try {
      expect((await load(url)).readReplicaOptions).toEqual([url])
    } finally {
      server.close()
    }
  })

  it('空文字なら従来どおり primary のみ', async () => {
    expect((await load('')).readReplicaOptions).toBeUndefined()
  })

  it('到達不能なら primary のみで起動する', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect((await load('postgres://x:y@127.0.0.1:1/payload')).readReplicaOptions).toBeUndefined()
  })
})
