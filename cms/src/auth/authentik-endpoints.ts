import { createHash, randomBytes } from 'crypto'

import type { Endpoint, Where } from 'payload'
import { generatePayloadCookie, getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser } from 'payload/shared'

import { optionalEnv, requireEnv } from '../env'
import { toCmsIdentity } from './identity'

const STATE_COOKIE = 'authentik_state'
const VERIFIER_COOKIE = 'authentik_verifier'
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
    // 認可コードを横取りされても、verifier を持つこのブラウザ以外はトークンに交換できないようにする
    const verifier = randomBytes(32).toString('base64url')
    url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'))
    url.searchParams.set('code_challenge_method', 'S256')

    const attributes = `Path=/; HttpOnly; SameSite=Lax; Max-Age=600${
      optionalEnv('NODE_ENV') === 'production' ? '; Secure' : ''
    }`
    const headers = new Headers({ Location: url.toString() })
    headers.append('Set-Cookie', `${STATE_COOKIE}=${state}; ${attributes}`)
    headers.append('Set-Cookie', `${VERIFIER_COOKIE}=${verifier}; ${attributes}`)
    return new Response(null, { status: 302, headers })
  },
}

const callback: Endpoint = {
  path: '/auth/authentik/callback',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? '', requireEnv('CMS_PUBLIC_URL'))
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const cookie = req.headers.get('cookie')
    const expectedState = cookie?.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1]
    const verifier = cookie?.match(new RegExp(`${VERIFIER_COOKIE}=([^;]+)`))?.[1]

    if (!code || !state || state !== expectedState || !verifier) {
      return Response.json({ errors: [{ message: 'state が一致しない' }] }, { status: 400 })
    }

    const tokenResponse = await fetch((await discovery()).token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
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
    const findUser = async (where: Where) =>
      (
        await payload.find({
          collection: 'users',
          depth: 0,
          limit: 1,
          overrideAccess: true,
          where,
        })
      ).docs[0]

    // IdP 移行で sub の体系が変わり、既存レコードの sub はどれも一致しない。
    // email の unique 制約により新規作成も通らないため、sub で引けないときだけ
    // email で引き当てて sub を張り替える (次回以降は sub で引ける)
    const bySub = await findUser({ authentik_sub: { equals: identity.subject } })
    // email は IdP 側で利用者が自己申告できる場合があり、未検証のまま既存アカウントへ紐付けたり
    // 新規作成したりすると、他人のメールアドレスで実行委員のアカウントを乗っ取れる。
    // sub で引けた既存ユーザーは IdP が同一人物と保証しているため対象外
    if (!bySub && claims.email_verified !== true) {
      req.payload.logger.warn({ subject: identity.subject }, 'email が未検証のため紐付け・作成を拒否')
      return Response.json({ errors: [{ message: 'メールアドレスが未検証' }] }, { status: 403 })
    }
    const existing = bySub ?? (await findUser({ email: { equals: identity.email } }))

    // グループ写像から学生団体を外した後は identity.role は実行委員以外に解決されないが、
    // 万一に備えて新規作成だけは実行委員のときに限る (荒牧祭SSOから学生団体を切り離す保険)
    if (!existing && identity.role !== 'executive') {
      req.payload.logger.warn(
        { subject: identity.subject, role: identity.role },
        'CMS に対応するグループを持たない',
      )
      return Response.json(
        { errors: [{ message: 'CMS に対応するグループを持たない' }] },
        { status: 403 },
      )
    }

    // 元が学生団体アカウントだったユーザーに実行委員としてログインされた場合、
    // 学生団体に伝わっていたパスワードで実行委員の権限を得られないよう差し替え、
    // 既存セッションも今回のログイン以外は無効にする
    const wasStudentExhibitor = existing?.role === 'student_exhibitor'

    // アカウント払い出しは IdP 側の既存フローが担うため、
    // CMS 側はパスワードを持たない受け皿を作るだけにとどめる
    const user = existing
      ? await payload.update({
          collection: 'users',
          id: existing.id,
          data: {
            // メールは IdP 側で変わりうるため、ログインのたびに追随させる
            authentik_sub: identity.subject,
            email: identity.email,
            role: identity.role,
            ...(wasStudentExhibitor
              ? { password: randomBytes(32).toString('hex'), sessions: [] }
              : {}),
          },
          overrideAccess: true,
          context: { skipPasswordRequirement: true },
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
          context: { skipPasswordRequirement: true },
        })

    const collection = payload.collections.users
    // Payload はセッションを DB に持ち、JWT の sid と突き合わせる。
    // 発行しないとトークンが無効扱いになり、管理画面がログイン画面へ戻される
    const { sid } = await addSessionToUser({
      collectionConfig: collection.config,
      payload,
      req,
      user: user as never,
    })
    const { token } = await jwtSign({
      fieldsToSign: getFieldsToSign({
        collectionConfig: collection.config,
        email: identity.email,
        sid,
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
