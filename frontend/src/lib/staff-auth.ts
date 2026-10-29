import type { StampEnv } from './cloudflare-env';
import {
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_TTL_SECONDS,
  issueStaffSession,
  verifyStaffSession,
} from './staff-session';
import { fromBase64Url, toBase64Url } from './stamp-signature';

const OIDC_COOKIE = 'aramakisai_staff_oidc';
const OIDC_COOKIE_TTL_SECONDS = 600;
const EXECUTIVE_ROLE = 'executive';
const DEFAULT_RETURN_TO = '/staff';
const CALLBACK_PATH = '/staff/auth/callback';

export type StaffAuthResult =
  | { readonly kind: 'allowed'; readonly staff: string }
  | { readonly kind: 'login_required'; readonly loginUrl: string }
  | { readonly kind: 'forbidden' };

export type StaffCallbackResult =
  | {
      readonly kind: 'ok';
      readonly location: string;
      readonly cookies: string[];
    }
  | { readonly kind: 'failed' }
  | { readonly kind: 'forbidden' };

const encoder = new TextEncoder();

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name)
      return part.slice(i + 1).trim();
  }
  return null;
}

function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

// 戻り先はクエリ (交換用QRの署名) を保ったまま、同一オリジンの /staff 配下に限る
export function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/staff') || value.includes('\\')) {
    return DEFAULT_RETURN_TO;
  }
  try {
    const u = new URL(value, 'http://localhost');
    if (u.origin !== 'http://localhost' || !/^\/staff(\/|$)/.test(u.pathname)) {
      return DEFAULT_RETURN_TO;
    }
    return u.pathname + u.search;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

interface Endpoints {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

async function discover(issuer: string): Promise<Endpoints> {
  const res = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error('discovery failed');
  const d = (await res.json()) as Partial<Endpoints>;
  if (!d.authorization_endpoint || !d.token_endpoint || !d.userinfo_endpoint) {
    throw new Error('discovery incomplete');
  }
  return d as Endpoints;
}

function random(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function startStaffLogin(
  request: Request,
  env: StampEnv,
): Promise<{ location: string; cookies: string[] }> {
  const url = new URL(request.url);
  const endpoints = await discover(env.STAFF_OIDC_ISSUER);
  const state = random();
  const verifier = random();
  const challenge = toBase64Url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(verifier)),
    ),
  );
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));
  const authorize = new URL(endpoints.authorization_endpoint);
  authorize.search = new URLSearchParams({
    client_id: env.STAFF_OIDC_CLIENT_ID,
    response_type: 'code',
    scope: 'openid email groups',
    redirect_uri: url.origin + CALLBACK_PATH,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  const saved = toBase64Url(
    encoder.encode(JSON.stringify({ state, verifier, returnTo })),
  );
  return {
    location: authorize.toString(),
    cookies: [setCookie(OIDC_COOKIE, saved, OIDC_COOKIE_TTL_SECONDS)],
  };
}

function readSavedLogin(request: Request) {
  const raw = readCookie(request, OIDC_COOKIE);
  const bytes = raw ? fromBase64Url(raw) : null;
  if (!bytes) return null;
  try {
    const v = JSON.parse(new TextDecoder().decode(bytes)) as Record<
      string,
      unknown
    >;
    if (
      typeof v.state === 'string' &&
      typeof v.verifier === 'string' &&
      typeof v.returnTo === 'string'
    ) {
      return { state: v.state, verifier: v.verifier, returnTo: v.returnTo };
    }
  } catch {
    // 形式不正は Cookie 無しと同じ扱い
  }
  return null;
}

export async function handleStaffCallback(
  request: Request,
  env: StampEnv,
  now: Date = new Date(),
): Promise<StaffCallbackResult> {
  const url = new URL(request.url);
  const saved = readSavedLogin(request);
  const code = url.searchParams.get('code');
  if (!saved || !code || url.searchParams.get('state') !== saved.state) {
    return { kind: 'failed' };
  }
  try {
    const endpoints = await discover(env.STAFF_OIDC_ISSUER);
    const basic = btoa(
      `${encodeURIComponent(env.STAFF_OIDC_CLIENT_ID)}:${encodeURIComponent(env.STAFF_OIDC_CLIENT_SECRET)}`,
    );
    const tokenRes = await fetch(endpoints.token_endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: url.origin + CALLBACK_PATH,
        code_verifier: saved.verifier,
      }),
    });
    if (!tokenRes.ok) return { kind: 'failed' };
    const { access_token } = (await tokenRes.json()) as {
      access_token?: unknown;
    };
    if (typeof access_token !== 'string') return { kind: 'failed' };
    const infoRes = await fetch(endpoints.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) return { kind: 'failed' };
    const info = (await infoRes.json()) as Record<string, unknown>;
    if (typeof info.sub !== 'string' || typeof info.email !== 'string') {
      return { kind: 'failed' };
    }
    if (!Array.isArray(info.groups) || !info.groups.includes(EXECUTIVE_ROLE)) {
      return { kind: 'forbidden' };
    }
    const session = await issueStaffSession(
      env.STAMP_SIGNING_SECRET,
      { subject: info.sub, email: info.email },
      now,
    );
    return {
      kind: 'ok',
      location: sanitizeReturnTo(saved.returnTo),
      cookies: [
        setCookie(STAFF_SESSION_COOKIE, session, STAFF_SESSION_TTL_SECONDS),
        setCookie(OIDC_COOKIE, '', 0),
      ],
    };
  } catch {
    return { kind: 'failed' };
  }
}

// セッションは executive のときだけ発行されるため、Cookie の検証が通れば許可でよい
export async function requireStaff(
  request: Request,
  env: StampEnv,
  now: Date = new Date(),
): Promise<StaffAuthResult> {
  if (env.STAMP_ENV === 'preview') return { kind: 'allowed', staff: 'preview' };
  const cookie = readCookie(request, STAFF_SESSION_COOKIE);
  const identity = cookie
    ? await verifyStaffSession(env.STAMP_SIGNING_SECRET, cookie, now)
    : null;
  if (identity) return { kind: 'allowed', staff: identity.email };
  const u = new URL(request.url);
  return {
    kind: 'login_required',
    loginUrl: `/staff/auth/login?returnTo=${encodeURIComponent(u.pathname + u.search)}`,
  };
}
