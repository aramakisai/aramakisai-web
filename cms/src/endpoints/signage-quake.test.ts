import type { PayloadRequest } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { relayHandler, signageQuakeEndpoints } from './signage-quake';

const env = { SIGNAGE_QUAKE_URL: 'https://relay.example', SIGNAGE_QUAKE_TOKEN: 'tok' };
const executive = { id: 1, role: 'executive', email: 'exec@example.com' };
const req = (user: unknown) => ({ user }) as unknown as PayloadRequest;
const status = { inPeriod: true, alert: { active: false } };
const okFetch = () => vi.fn().mockResolvedValue(Response.json(status));

describe('エンドポイントの登録', () => {
  it('GET /signage-quake と POST /signage-quake/dismiss', () => {
    expect(signageQuakeEndpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      'get /signage-quake',
      'post /signage-quake/dismiss',
    ]);
  });
});

describe('relayHandler', () => {
  it('実行委員でなければ 403(リレーを呼ばない)', async () => {
    const f = okFetch();
    for (const user of [null, { id: 2, role: 'student_exhibitor', email: 's@example.com' }]) {
      for (const path of ['/status', '/dismiss'] as const) {
        expect((await relayHandler(path, env, f)(req(user))).status).toBe(403);
      }
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('URL とトークンが揃わなければ 503', async () => {
    const f = okFetch();
    for (const e of [{}, { SIGNAGE_QUAKE_URL: 'https://relay.example' }, { SIGNAGE_QUAKE_TOKEN: 'tok' }]) {
      const res = await relayHandler('/status', e, f)(req(executive));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'not_configured' });
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('状態の取得は Bearer 付きで GET /status を中継し、3秒の打ち切りを付ける', async () => {
    const f = okFetch();
    const res = await relayHandler('/status', env, f)(req(executive));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(status);
    const [url, init] = f.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://relay.example/status');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.body).toBeUndefined();
  });

  it('解除は認証したユーザーのメールを by に付けて POST /dismiss へ中継する', async () => {
    const f = okFetch();
    const res = await relayHandler('/dismiss', env, f)(req(executive));
    expect(res.status).toBe(200);
    const [url, init] = f.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://relay.example/dismiss');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ by: 'exec@example.com' });
  });

  it('メールが無い・長すぎるユーザーの解除は 403', async () => {
    const f = okFetch();
    expect((await relayHandler('/dismiss', env, f)(req({ id: 1, role: 'executive' }))).status).toBe(403);
    expect(
      (await relayHandler('/dismiss', env, f)(req({ ...executive, email: 'a'.repeat(255) }))).status,
    ).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });

  it('届かない・打ち切り・リレーの異常応答は 502', async () => {
    const cases = [
      vi.fn().mockRejectedValue(new Error('network')),
      vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')),
      vi.fn().mockResolvedValue(new Response('bad', { status: 401 })),
      vi.fn().mockResolvedValue(new Response('bad', { status: 502 })),
    ];
    for (const f of cases) {
      const res = await relayHandler('/status', env, f)(req(executive));
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'relay_unreachable' });
    }
  });
});
