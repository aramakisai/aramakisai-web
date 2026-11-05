import { createHash } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('payload', () => ({
  generatePayloadCookie: () => 'payload-token=jwt',
  getFieldsToSign: () => ({}),
  jwtSign: async () => ({ token: 'jwt' }),
}))

vi.mock('payload/shared', () => ({
  addSessionToUser: async () => ({ sid: 'sid' }),
}))

const DISCOVERY = {
  authorization_endpoint: 'https://idp.example.com/application/o/authorize/',
  token_endpoint: 'https://idp.example.com/application/o/token/',
  userinfo_endpoint: 'https://idp.example.com/application/o/userinfo/',
}

async function loadAuthorize() {
  vi.resetModules()
  const { authentikEndpoints } = await import('./authentik-endpoints')
  const authorize = authentikEndpoints.find((e) => e.path === '/auth/authentik')
  expect(authorize).toBeDefined()
  return authorize!
}

describe('Authentik の認可経路', () => {
  beforeEach(() => {
    process.env.AUTHENTIK_ISSUER_URL = 'https://idp.example.com/application/o/cms-prod/'
    process.env.AUTHENTIK_CLIENT_ID = 'cms-prod'
    process.env.CMS_PUBLIC_URL = 'https://cms.example.com'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('discovery が返す authorization_endpoint へ飛ばす', async () => {
    const fetchMock = vi.fn(async () => Response.json(DISCOVERY))
    vi.stubGlobal('fetch', fetchMock)

    const authorize = await loadAuthorize()
    const response = await authorize.handler({} as never)
    const location = new URL(response.headers.get('Location')!)

    expect(`${location.origin}${location.pathname}`).toBe(DISCOVERY.authorization_endpoint)
    expect(location.searchParams.get('client_id')).toBe('cms-prod')
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://cms.example.com/api/auth/authentik/callback',
    )
    // profile を含めると access token にアバターの data URI が乗り、ヘッダ上限を超える
    expect(location.searchParams.get('scope')).toBe('openid email groups')

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://idp.example.com/application/o/cms-prod/.well-known/openid-configuration'),
    )
  })

  it('PKCE (S256) の challenge を付け、verifier を HttpOnly の Cookie に持たせる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(DISCOVERY)))

    const authorize = await loadAuthorize()
    const response = await authorize.handler({} as never)
    const location = new URL(response.headers.get('Location')!)
    const cookies = response.headers.getSetCookie()
    const verifierCookie = cookies.find((c) => c.startsWith('authentik_verifier='))!

    expect(location.searchParams.get('code_challenge_method')).toBe('S256')
    const verifier = verifierCookie.split(';')[0].split('=')[1]
    expect(location.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(verifier).digest('base64url'),
    )
    expect(verifierCookie).toMatch(/HttpOnly/)
    expect(verifierCookie).toMatch(/SameSite=Lax/)
    expect(cookies.some((c) => c.startsWith('authentik_state='))).toBe(true)
    expect(location.searchParams.has('nonce')).toBe(false)
  })

  it('discovery の取得は一度だけで、二度目以降は使い回す', async () => {
    const fetchMock = vi.fn(async () => Response.json(DISCOVERY))
    vi.stubGlobal('fetch', fetchMock)

    const authorize = await loadAuthorize()
    await authorize.handler({} as never)
    await authorize.handler({} as never)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('discovery に失敗したら次の要求で取り直す', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValue(Response.json(DISCOVERY))
    vi.stubGlobal('fetch', fetchMock)

    const authorize = await loadAuthorize()
    await expect(authorize.handler({} as never)).rejects.toThrow()

    const response = await authorize.handler({} as never)
    expect(response.status).toBe(302)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('Authentik の callback', () => {
  beforeEach(() => {
    process.env.AUTHENTIK_ISSUER_URL = 'https://idp.example.com/'
    process.env.AUTHENTIK_CLIENT_ID = 'cms-prod'
    process.env.AUTHENTIK_CLIENT_SECRET = 'secret'
    process.env.CMS_PUBLIC_URL = 'https://cms.example.com'

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = input.toString()
        if (url.includes('openid-configuration')) return Response.json(DISCOVERY)
        if (url === DISCOVERY.token_endpoint) return Response.json({ access_token: 'at' })
        return Response.json({
          sub: 'zitadel-sub',
          email: 'a@example.com',
          email_verified: true,
          groups: ['executive'],
        })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sub で引けない既存ユーザーを email で引き当て、sub を張り替える', async () => {
    const find = vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      'email' in where ? { docs: [{ id: 7 }] } : { docs: [] },
    )
    const update = vi.fn(async () => ({ id: 7 }))
    const create = vi.fn(async () => ({ id: 8 }))

    vi.resetModules()
    const { authentikEndpoints } = await import('./authentik-endpoints')
    const callback = authentikEndpoints.find((e) => e.path === '/auth/authentik/callback')!

    const response = await callback.handler({
      url: '/api/auth/authentik/callback?code=c&state=s',
      headers: new Headers({ cookie: 'authentik_state=s; authentik_verifier=v' }),
      payload: {
        find,
        update,
        create,
        logger: { error: vi.fn(), warn: vi.fn() },
        collections: { users: { config: { auth: { tokenExpiration: 100 } } } },
        config: { cookiePrefix: 'payload' },
        secret: 'payload-secret',
      },
    } as never)

    expect(find).toHaveBeenCalledTimes(2)
    expect(create).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        data: expect.objectContaining({ authentik_sub: 'zitadel-sub' }),
      }),
    )
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/admin')
  })

  it('実行委員の既存ユーザーはパスワード・セッションを変更せずログインできる', async () => {
    const find = vi.fn(async () => ({ docs: [{ id: 7, role: 'executive' }] }))
    const update = vi.fn(async () => ({ id: 7 }))
    const create = vi.fn(async () => ({ id: 8 }))

    vi.resetModules()
    const { authentikEndpoints } = await import('./authentik-endpoints')
    const callback = authentikEndpoints.find((e) => e.path === '/auth/authentik/callback')!

    const response = await callback.handler({
      url: '/api/auth/authentik/callback?code=c&state=s',
      headers: new Headers({ cookie: 'authentik_state=s; authentik_verifier=v' }),
      payload: {
        find,
        update,
        create,
        logger: { error: vi.fn(), warn: vi.fn() },
        collections: { users: { config: { auth: { tokenExpiration: 100 } } } },
        config: { cookiePrefix: 'payload' },
        secret: 'payload-secret',
      },
    } as never)

    expect(create).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        data: expect.not.objectContaining({ password: expect.anything(), sessions: expect.anything() }),
      }),
    )
    expect(response.status).toBe(302)
  })

  it('メールが一致した学生団体アカウントは実行委員になり、パスワードを差し替えて他セッションを無効にする', async () => {
    const find = vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      'email' in where ? { docs: [{ id: 7, role: 'student_exhibitor' }] } : { docs: [] },
    )
    const update = vi.fn(async () => ({ id: 7 }))
    const create = vi.fn(async () => ({ id: 8 }))

    vi.resetModules()
    const { authentikEndpoints } = await import('./authentik-endpoints')
    const callback = authentikEndpoints.find((e) => e.path === '/auth/authentik/callback')!

    const response = await callback.handler({
      url: '/api/auth/authentik/callback?code=c&state=s',
      headers: new Headers({ cookie: 'authentik_state=s; authentik_verifier=v' }),
      payload: {
        find,
        update,
        create,
        logger: { error: vi.fn(), warn: vi.fn() },
        collections: { users: { config: { auth: { tokenExpiration: 100 } } } },
        config: { cookiePrefix: 'payload' },
        secret: 'payload-secret',
      },
    } as never)

    expect(create).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        data: expect.objectContaining({
          role: 'executive',
          password: expect.stringMatching(/^[0-9a-f]{64}$/),
          sessions: [],
        }),
      }),
    )
    expect(response.status).toBe(302)
  })

  it('OIDC が解決したロールが実行委員でない場合はユーザーを新規作成せず 403 を返す (写像除去後の保険)', async () => {
    vi.resetModules()
    vi.doMock('./identity', () => ({
      toCmsIdentity: () => ({
        subject: 'zitadel-sub',
        email: 'a@example.com',
        role: 'student_exhibitor',
      }),
    }))

    const find = vi.fn(async () => ({ docs: [] }))
    const update = vi.fn()
    const create = vi.fn()

    const { authentikEndpoints } = await import('./authentik-endpoints')
    const callback = authentikEndpoints.find((e) => e.path === '/auth/authentik/callback')!

    const response = await callback.handler({
      url: '/api/auth/authentik/callback?code=c&state=s',
      headers: new Headers({ cookie: 'authentik_state=s; authentik_verifier=v' }),
      payload: {
        find,
        update,
        create,
        logger: { error: vi.fn(), warn: vi.fn() },
        collections: { users: { config: { auth: { tokenExpiration: 100 } } } },
        config: { cookiePrefix: 'payload' },
        secret: 'payload-secret',
      },
    } as never)

    vi.doUnmock('./identity')

    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(response.status).toBe(403)
  })

  const runCallback = async (userinfo: Record<string, unknown>, docs: { id: number; role: string }[], cookie?: string) => {
    const fetchMock = vi.fn(async (input: URL | string, init?: RequestInit) => {
      const url = input.toString()
      if (url.includes('openid-configuration')) return Response.json(DISCOVERY)
      if (url === DISCOVERY.token_endpoint) return Response.json({ access_token: 'at' })
      return Response.json(userinfo)
    })
    vi.stubGlobal('fetch', fetchMock)
    const find = vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      'email' in where ? { docs } : { docs: [] },
    )
    const update = vi.fn(async () => ({ id: 7 }))
    const create = vi.fn(async () => ({ id: 8 }))

    vi.resetModules()
    const { authentikEndpoints } = await import('./authentik-endpoints')
    const callback = authentikEndpoints.find((e) => e.path === '/auth/authentik/callback')!
    const response = await callback.handler({
      url: '/api/auth/authentik/callback?code=c&state=s',
      headers: new Headers({ cookie: cookie ?? 'authentik_state=s; authentik_verifier=v' }),
      payload: {
        find,
        update,
        create,
        logger: { error: vi.fn(), warn: vi.fn() },
        collections: { users: { config: { auth: { tokenExpiration: 100 } } } },
        config: { cookiePrefix: 'payload' },
        secret: 'payload-secret',
      },
    } as never)
    return { response, find, update, create, fetchMock }
  }
  const userinfo = { sub: 'new-sub', email: 'a@example.com', groups: ['executive'] }

  it('email_verified が true でなければ email での紐付けも新規作成もしない', async () => {
    for (const claims of [userinfo, { ...userinfo, email_verified: 'true' }, { ...userinfo, email_verified: false }]) {
      const linked = await runCallback(claims, [{ id: 7, role: 'executive' }])
      expect(linked.response.status).toBe(403)
      expect(linked.update).not.toHaveBeenCalled()
      expect(linked.create).not.toHaveBeenCalled()

      const created = await runCallback(claims, [])
      expect(created.response.status).toBe(403)
      expect(created.create).not.toHaveBeenCalled()
    }
  })

  it('sub で引けた既存ユーザーは email_verified が無くてもログインできる', async () => {
    const find = vi.fn(async () => ({ docs: [{ id: 7, role: 'executive' }] }))
    const update = vi.fn(async () => ({ id: 7 }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = input.toString()
        if (url.includes('openid-configuration')) return Response.json(DISCOVERY)
        if (url === DISCOVERY.token_endpoint) return Response.json({ access_token: 'at' })
        return Response.json(userinfo)
      }),
    )
    vi.resetModules()
    const { authentikEndpoints } = await import('./authentik-endpoints')
    const callback = authentikEndpoints.find((e) => e.path === '/auth/authentik/callback')!
    const response = await callback.handler({
      url: '/api/auth/authentik/callback?code=c&state=s',
      headers: new Headers({ cookie: 'authentik_state=s; authentik_verifier=v' }),
      payload: {
        find,
        update,
        create: vi.fn(),
        logger: { error: vi.fn(), warn: vi.fn() },
        collections: { users: { config: { auth: { tokenExpiration: 100 } } } },
        config: { cookiePrefix: 'payload' },
        secret: 'payload-secret',
      },
    } as never)
    expect(response.status).toBe(302)
  })

  it('トークン交換に code_verifier を送り、verifier の Cookie が無ければ拒否する', async () => {
    const ok = await runCallback({ ...userinfo, email_verified: true }, [{ id: 7, role: 'executive' }])
    const tokenCall = ok.fetchMock.mock.calls.find(([url]) => url.toString() === DISCOVERY.token_endpoint)!
    expect((tokenCall[1]!.body as URLSearchParams).get('code_verifier')).toBe('v')

    const missing = await runCallback({ ...userinfo, email_verified: true }, [], 'authentik_state=s')
    expect(missing.response.status).toBe(400)
    expect(missing.fetchMock.mock.calls.some(([url]) => url.toString() === DISCOVERY.token_endpoint)).toBe(false)
  })
})
