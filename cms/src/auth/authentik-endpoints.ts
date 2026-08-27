import { randomBytes } from 'crypto';

import type { Endpoint } from 'payload';
import { generatePayloadCookie, getFieldsToSign, jwtSign } from 'payload';

import { optionalEnv, requireEnv } from '../env';
import { toCmsIdentity } from './identity';

const STATE_COOKIE = 'authentik_state';
const SCOPE = 'openid profile email groups';

function issuer(): string {
  return requireEnv('AUTHENTIK_ISSUER_URL').replace(/\/?$/, '/');
}

function redirectUri(): string {
  return `${requireEnv('CMS_PUBLIC_URL').replace(/\/$/, '')}/api/auth/authentik/callback`;
}

const authorize: Endpoint = {
  path: '/auth/authentik',
  method: 'get',
  handler: () => {
    const state = randomBytes(16).toString('hex');
    const url = new URL('authorize/', issuer());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', requireEnv('AUTHENTIK_CLIENT_ID'));
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);

    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${
          optionalEnv('NODE_ENV') === 'production' ? '; Secure' : ''
        }`,
      },
    });
  },
};

const callback: Endpoint = {
  path: '/auth/authentik/callback',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? '', requireEnv('CMS_PUBLIC_URL'));
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const expectedState = req.headers
      .get('cookie')
      ?.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1];

    if (!code || !state || state !== expectedState) {
      return Response.json({ errors: [{ message: 'state が一致しない' }] }, { status: 400 });
    }

    const tokenResponse = await fetch(new URL('token/', issuer()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        client_id: requireEnv('AUTHENTIK_CLIENT_ID'),
        client_secret: requireEnv('AUTHENTIK_CLIENT_SECRET'),
      }),
    });
    if (!tokenResponse.ok) {
      return Response.json({ errors: [{ message: 'トークン取得に失敗' }] }, { status: 401 });
    }
    const { access_token: accessToken } = (await tokenResponse.json()) as {
      access_token?: string;
    };
    if (!accessToken) {
      return Response.json({ errors: [{ message: 'トークン取得に失敗' }] }, { status: 401 });
    }

    const userinfoResponse = await fetch(new URL('userinfo/', issuer()), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const identity = userinfoResponse.ok
      ? toCmsIdentity((await userinfoResponse.json()) as Record<string, unknown>)
      : null;
    if (!identity) {
      return Response.json(
        { errors: [{ message: 'CMS に対応するグループを持たない' }] },
        { status: 403 },
      );
    }

    const { payload } = req;
    const existing = await payload.find({
      collection: 'users',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { email: { equals: identity.email } },
    });

    // アカウント払い出しは Authentik 側の既存フローが担うため、
    // CMS 側はパスワードを持たない受け皿を作るだけにとどめる
    const user = existing.docs[0]
      ? await payload.update({
          collection: 'users',
          id: existing.docs[0].id,
          data: { role: identity.role },
          overrideAccess: true,
        })
      : await payload.create({
          collection: 'users',
          data: {
            email: identity.email,
            role: identity.role,
            password: randomBytes(32).toString('hex'),
          },
          overrideAccess: true,
        });

    const collection = payload.collections.users;
    const { token } = await jwtSign({
      fieldsToSign: getFieldsToSign({
        collectionConfig: collection.config,
        email: identity.email,
        user: user as never,
      }),
      secret: payload.secret,
      tokenExpiration: collection.config.auth.tokenExpiration,
    });

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
    });
  },
};

export const authentikEndpoints: Endpoint[] = [authorize, callback];
