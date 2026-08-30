import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
