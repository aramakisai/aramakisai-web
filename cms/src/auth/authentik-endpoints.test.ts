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
      headers: new Headers({ cookie: 'authentik_state=s' }),
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
      headers: new Headers({ cookie: 'authentik_state=s' }),
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
      headers: new Headers({ cookie: 'authentik_state=s' }),
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
      headers: new Headers({ cookie: 'authentik_state=s' }),
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
})
