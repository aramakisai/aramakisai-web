import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StampEnv } from './cloudflare-env';
import {
  handleStaffCallback,
  requireStaff,
  sanitizeReturnTo,
  startStaffLogin,
} from './staff-auth';
import { issueStaffSession } from './staff-session';
import { toBase64Url } from './stamp-signature';

const ISSUER = 'https://idp.example.com';
const NOW = new Date('2026-11-14T03:00:00Z');
const env = (name: StampEnv['STAMP_ENV'] = 'prod') =>
  ({
    STAMP_ENV: name,
    STAMP_SIGNING_SECRET: 'test-secret-0123456789-0123456789-abcd', // gitleaks:allow
    STAFF_OIDC_ISSUER: ISSUER,
    STAFF_OIDC_CLIENT_ID: 'cid',
    STAFF_OIDC_CLIENT_SECRET: 'csecret',
  }) as unknown as StampEnv;

const req = (url: string, cookie?: string) =>
  new Request(url, cookie ? { headers: { cookie } } : undefined);

function cookieValue(setCookies: readonly string[], name: string) {
  const c = setCookies.find((s) => s.startsWith(`${name}=`));
  return c?.slice(name.length + 1).split(';')[0];
}

afterEach(() => vi.unstubAllGlobals());

describe('sanitizeReturnTo', () => {
  it.each([
    ['/staff', '/staff'],
    ['/staff/visitors/abc?t=1.sig', '/staff/visitors/abc?t=1.sig'],
    ['/staff/scan#x', '/staff/scan'],
    ['https://evil.example/staff', '/staff'],
    ['//evil.example/staff', '/staff'],
    ['/staffx', '/staff'],
    ['/other', '/staff'],
    ['/staff/../other', '/staff'],
    ['/staff\\@evil', '/staff'],
    [null, '/staff'],
  ])('%s -> %s', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });
});

describe('startStaffLogin', () => {
  function stubDiscovery() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          authorization_endpoint: `${ISSUER}/oauth/v2/authorize`,
          token_endpoint: `${ISSUER}/oauth/v2/token`,
          userinfo_endpoint: `${ISSUER}/oidc/v1/userinfo`,
        }),
      ),
    );
  }

  it('state・PKCE・戻り先を Cookie に保存して authorize へ送る', async () => {
    stubDiscovery();
    const r = await startStaffLogin(
      req(
        'https://aramakisai.com/staff/auth/login?returnTo=/staff/visitors/v?t=1.s',
      ),
      env(),
    );
    const loc = new URL(r.location);
    expect(loc.origin + loc.pathname).toBe(`${ISSUER}/oauth/v2/authorize`);
    expect(loc.searchParams.get('client_id')).toBe('cid');
    expect(loc.searchParams.get('response_type')).toBe('code');
    expect(loc.searchParams.get('scope')).toBe('openid email groups');
    expect(loc.searchParams.get('redirect_uri')).toBe(
      'https://aramakisai.com/staff/auth/callback',
    );
    expect(loc.searchParams.get('code_challenge_method')).toBe('S256');
    const saved = JSON.parse(
      atob(
        cookieValue(r.cookies, 'aramakisai_staff_oidc')!
          .replace(/-/g, '+')
          .replace(/_/g, '/'),
      ),
    );
    expect(saved.state).toBe(loc.searchParams.get('state'));
    expect(saved.returnTo).toBe('/staff/visitors/v?t=1.s');
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(saved.verifier),
    );
    expect(loc.searchParams.get('code_challenge')).toBe(
      toBase64Url(new Uint8Array(digest)),
    );
    const attrs = r.cookies.find((c) =>
      c.startsWith('aramakisai_staff_oidc='),
    )!;
    expect(attrs).toMatch(/HttpOnly/);
    expect(attrs).toMatch(/Secure/);
    expect(attrs).toMatch(/SameSite=Lax/);
    expect(attrs).toMatch(/Max-Age=600/);
  });

  it('戻り先が /staff 配下でなければ /staff にする', async () => {
    stubDiscovery();
    const r = await startStaffLogin(
      req(
        'https://aramakisai.com/staff/auth/login?returnTo=https://evil.example/',
      ),
      env(),
    );
    const saved = JSON.parse(
      atob(
        cookieValue(r.cookies, 'aramakisai_staff_oidc')!
          .replace(/-/g, '+')
          .replace(/_/g, '/'),
      ),
    );
    expect(saved.returnTo).toBe('/staff');
  });
});

describe('handleStaffCallback', () => {
  const oidcCookie = (state = 'st', returnTo = '/staff/scan') =>
    `aramakisai_staff_oidc=${toBase64Url(
      new TextEncoder().encode(
        JSON.stringify({ state, verifier: 'ver', returnTo }),
      ),
    )}`;
  const url = (q = 'code=c&state=st') =>
    `https://aramakisai.com/staff/auth/callback?${q}`;

  function stubIdp(opts: {
    groups?: unknown;
    tokenOk?: boolean;
    sub?: unknown;
    email?: unknown;
  }) {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const u = String(input);
        if (u.endsWith('/.well-known/openid-configuration')) {
          return Response.json({
            authorization_endpoint: `${ISSUER}/oauth/v2/authorize`,
            token_endpoint: `${ISSUER}/oauth/v2/token`,
            userinfo_endpoint: `${ISSUER}/oidc/v1/userinfo`,
          });
        }
        if (u.endsWith('/oauth/v2/token')) {
          void init;
          return opts.tokenOk === false
            ? new Response('no', { status: 400 })
            : Response.json({ access_token: 'at' });
        }
        return Response.json({
          sub: 'sub' in opts ? opts.sub : 'u-1',
          email: 'email' in opts ? opts.email : 'a@example.com',
          groups: opts.groups,
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('executive ならセッションを発行して戻り先へ', async () => {
    const f = stubIdp({ groups: ['student_exhibitor', 'executive'] });
    const r = await handleStaffCallback(req(url(), oidcCookie()), env(), NOW);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.location).toBe('/staff/scan');
    const session = cookieValue(r.cookies, 'aramakisai_staff')!;
    expect(
      await requireStaff(
        req('https://aramakisai.com/staff', `aramakisai_staff=${session}`),
        env(),
        NOW,
      ),
    ).toEqual({ kind: 'allowed', staff: 'a@example.com' });
    const attrs = r.cookies.find((c) => c.startsWith('aramakisai_staff='))!;
    expect(attrs).toMatch(/HttpOnly/);
    expect(attrs).toMatch(/Max-Age=43200/);
    expect(
      r.cookies.find((c) => c.startsWith('aramakisai_staff_oidc=')),
    ).toMatch(/Max-Age=0/);
    const tokenCall = f.mock.calls.find(([u]) => String(u).endsWith('/token'))!;
    const init = tokenCall[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${btoa('cid:csecret')}`,
    );
    const body = new URLSearchParams(String(init.body));
    expect(body.get('code_verifier')).toBe('ver');
    expect(body.get('redirect_uri')).toBe(
      'https://aramakisai.com/staff/auth/callback',
    );
  });

  it.each([[['student_exhibitor']], [undefined], ['executive'], [[1]]])(
    'executive が無ければ forbidden (groups=%j)',
    async (groups) => {
      stubIdp({ groups });
      const r = await handleStaffCallback(req(url(), oidcCookie()), env(), NOW);
      expect(r).toEqual({ kind: 'forbidden' });
    },
  );

  it('state 不一致・Cookie 無し・code 無しは failed で IdP を呼ばない', async () => {
    const f = stubIdp({ groups: ['executive'] });
    expect(
      await handleStaffCallback(
        req(url('code=c&state=other'), oidcCookie()),
        env(),
        NOW,
      ),
    ).toEqual({ kind: 'failed' });
    expect(await handleStaffCallback(req(url()), env(), NOW)).toEqual({
      kind: 'failed',
    });
    expect(
      await handleStaffCallback(req(url('state=st'), oidcCookie()), env(), NOW),
    ).toEqual({ kind: 'failed' });
    expect(f).not.toHaveBeenCalled();
  });

  it('token 交換の失敗・通信例外・userinfo の欠落は failed', async () => {
    stubIdp({ tokenOk: false });
    expect(
      await handleStaffCallback(req(url(), oidcCookie()), env(), NOW),
    ).toEqual({
      kind: 'failed',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    expect(
      await handleStaffCallback(req(url(), oidcCookie()), env(), NOW),
    ).toEqual({
      kind: 'failed',
    });
    stubIdp({ groups: ['executive'], email: undefined });
    expect(
      await handleStaffCallback(req(url(), oidcCookie()), env(), NOW),
    ).toEqual({
      kind: 'failed',
    });
  });

  it('保存された戻り先も /staff 配下に制限し直す', async () => {
    stubIdp({ groups: ['executive'] });
    const r = await handleStaffCallback(
      req(url(), oidcCookie('st', 'https://evil.example/')),
      env(),
      NOW,
    );
    expect(r.kind === 'ok' && r.location).toBe('/staff');
  });
});

describe('requireStaff', () => {
  it('preview は Cookie なしで通し、担当者名は preview', async () => {
    expect(
      await requireStaff(req('https://x.example/staff'), env('preview'), NOW),
    ).toEqual({
      kind: 'allowed',
      staff: 'preview',
    });
  });

  it('Cookie が無い・改ざん・期限切れはログイン要求で、戻り先にクエリを含める', async () => {
    const e = env();
    const good = await issueStaffSession(
      e.STAMP_SIGNING_SECRET,
      { subject: 'u', email: 'a@example.com' },
      NOW,
    );
    const target = 'https://aramakisai.com/staff/visitors/v1?t=1.sig';
    const expected = {
      kind: 'login_required',
      loginUrl: `/staff/auth/login?returnTo=${encodeURIComponent('/staff/visitors/v1?t=1.sig')}`,
    };
    expect(await requireStaff(req(target), e, NOW)).toEqual(expected);
    expect(
      await requireStaff(
        req(target, `aramakisai_staff=${good.slice(0, -1)}A`),
        e,
        NOW,
      ),
    ).toEqual(expected);
    expect(
      await requireStaff(
        req(target, `aramakisai_staff=${good}`),
        e,
        new Date(NOW.getTime() + 13 * 3600 * 1000),
      ),
    ).toEqual(expected);
    expect(
      await requireStaff(req(target, `x=1; aramakisai_staff=${good}`), e, NOW),
    ).toEqual({ kind: 'allowed', staff: 'a@example.com' });
  });
});
