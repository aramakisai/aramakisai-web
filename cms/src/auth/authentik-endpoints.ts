import { randomBytes } from 'crypto'

import type { Endpoint } from 'payload'
import { generatePayloadCookie, getFieldsToSign, jwtSign } from 'payload'

import { optionalEnv, requireEnv } from '../env'
import { toCmsIdentity } from './identity'

const STATE_COOKIE = 'authentik_state'
// profile は要求しない。Authentik のアバターは data URI (base64 PNG) として
// picture クレームに入り、実測で access token が 228KB まで膨らむ。
// userinfo 呼び出しの Authorization ヘッダがサイズ上限を超えて弾かれる。
// 必要なのは sub / email / groups の 3 つだけで、いずれも profile 以外から取れる
const SCOPE = 'openid email groups'

function issuer(): string {
  return requireEnv('AUTHENTIK_ISSUER_URL').replace(/\/?$/, '/')
}

function redirectUri(): string {
  return `${requireEnv('CMS_PUBLIC_URL').replace(/\/$/, '')}/api/auth/authentik/callback`
}

type Discovery = {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
}

let discoveryPromise: Promise<Discovery> | null = null

/**
 * Authentik の authorize / token / userinfo はアプリケーション別パスの下ではなく
 * テナント共通のパスにある。issuer に継ぎ足すと 404 になるため discovery から引く。
 */
function discovery(): Promise<Discovery> {
  discoveryPromise ??= fetch(new URL('.well-known/openid-configuration', issuer()))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`OIDC discovery に失敗: ${response.status}`)
      }
      return response.json() as Promise<Discovery>
    })
    .catch((error: unknown) => {
      // 失敗を握ったままにすると以降ずっと同じ失敗を返すため、次の要求で取り直す
      discoveryPromise = null
      throw error
    })
  return discoveryPromise
}

const authorize: Endpoint = {
  path: '/auth/authentik',
  method: 'get',
  handler: async () => {
    const state = randomBytes(16).toString('hex')
    const url = new URL((await discovery()).authorization_endpoint)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', requireEnv('AUTHENTIK_CLIENT_ID'))
    url.searchParams.set('redirect_uri', redirectUri())
    url.searchParams.set('scope', SCOPE)
    url.searchParams.set('state', state)

    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${
          optionalEnv('NODE_ENV') === 'production' ? '; Secure' : ''
        }`,
      },
    })
  },
}

const callback: Endpoint = {
  path: '/auth/authentik/callback',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? '', requireEnv('CMS_PUBLIC_URL'))
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const expectedState = req.headers
      .get('cookie')
      ?.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1]

    if (!code || !state || state !== expectedState) {
      return Response.json({ errors: [{ message: 'state が一致しない' }] }, { status: 400 })
    }

    const tokenResponse = await fetch((await discovery()).token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        client_id: requireEnv('AUTHENTIK_CLIENT_ID'),
        client_secret: requireEnv('AUTHENTIK_CLIENT_SECRET'),
      }),
    })
    if (!tokenResponse.ok) {
      return Response.json({ errors: [{ message: 'トークン取得に失敗' }] }, { status: 401 })
    }
    const { access_token: accessToken } = (await tokenResponse.json()) as {
      access_token?: string
    }
    if (!accessToken) {
      return Response.json({ errors: [{ message: 'トークン取得に失敗' }] }, { status: 401 })
    }

    const userinfoResponse = await fetch((await discovery()).userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    // IdP 側の失敗とグループ不一致を同じ応答にすると、原因の切り分けができなくなる
    if (!userinfoResponse.ok) {
      req.payload.logger.error(
        { status: userinfoResponse.status, body: await userinfoResponse.text() },
        'userinfo の取得に失敗',
      )
      return Response.json({ errors: [{ message: 'userinfo の取得に失敗' }] }, { status: 502 })
    }
    const claims = (await userinfoResponse.json()) as Record<string, unknown>
    const identity = toCmsIdentity(claims)
    if (!identity) {
      req.payload.logger.warn(
        { claimNames: Object.keys(claims), groups: claims.groups },
        'CMS に対応するグループを持たない',
      )
      return Response.json(
        { errors: [{ message: 'CMS に対応するグループを持たない' }] },
        { status: 403 },
      )
    }

    const { payload } = req
    const existing = await payload.find({
      collection: 'users',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { authentik_sub: { equals: identity.subject } },
    })

    // アカウント払い出しは Authentik 側の既存フローが担うため、
    // CMS 側はパスワードを持たない受け皿を作るだけにとどめる
    const user = existing.docs[0]
      ? await payload.update({
          collection: 'users',
          id: existing.docs[0].id,
          // メールは Authentik 側で変わりうるため、ログインのたびに追随させる
          data: { email: identity.email, role: identity.role },
          overrideAccess: true,
        })
      : await payload.create({
          collection: 'users',
          data: {
            authentik_sub: identity.subject,
            email: identity.email,
            role: identity.role,
            password: randomBytes(32).toString('hex'),
          },
          overrideAccess: true,
        })

    const collection = payload.collections.users
    const { token } = await jwtSign({
      fieldsToSign: getFieldsToSign({
        collectionConfig: collection.config,
        email: identity.email,
        user: user as never,
      }),
      secret: payload.secret,
      tokenExpiration: collection.config.auth.tokenExpiration,
    })

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/admin',
        'Set-Cookie': generatePayloadCookie({
          collectionAuthConfig: collection.config.auth,
          cookiePrefix: payload.config.cookiePrefix,
          token,
        }),
      },
    })
  },
}

export const authentikEndpoints: Endpoint[] = [authorize, callback]
