import { describe, expect, it, vi } from 'vitest';
import { handleRequest, handleScheduled } from './http';
import type { QuakeRelayRpc, QuakeRelayStatus } from './rpc';

const NOW = Date.parse('2026-10-24T00:00:00+09:00');
const env = {
  QUAKE_ACTIVE_FROM: '2026-10-23T09:00:00+09:00',
  QUAKE_ACTIVE_UNTIL: '2026-11-22T00:00:00+09:00',
  SIGNAGE_QUAKE_TOKEN: 'secret-token',
};
const status = { inPeriod: true } as unknown as QuakeRelayStatus;

function relay(over: Partial<QuakeRelayRpc> = {}) {
  const r: QuakeRelayRpc = {
    ensure: vi.fn(async () => {}),
    status: vi.fn(async () => status),
    dismiss: vi.fn(async () => ({ ok: true as const, status })),
    inject: vi.fn(async () => 'accepted' as const),
    ...over,
  };
  return r;
}

const req = (
  path: string,
  init: RequestInit & { token?: string | null } = {},
) => {
  const { token = 'secret-token', ...rest } = init;
  const headers = new Headers(rest.headers);
  if (token !== null) headers.set('Authorization', `Bearer ${token}`);
  return new Request(`https://q.test${path}`, { ...rest, headers });
};

describe('handleRequest', () => {
  it('トークン無し・誤りは401で、DOを呼ばない', async () => {
    const r = relay();
    for (const token of [null, 'wrong', 'secret-token-x', '']) {
      const res = await handleRequest(req('/status', { token }), env, () => r);
      expect(res.status).toBe(401);
    }
    expect(r.status).not.toHaveBeenCalled();
  });

  it('GET /status は状態を返す', async () => {
    const res = await handleRequest(req('/status'), env, () => relay());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(status);
  });

  it('その他のパス・メソッドは404', async () => {
    for (const [path, method] of [
      ['/', 'GET'],
      ['/status', 'POST'],
      ['/dismiss', 'GET'],
      ['/x', 'GET'],
    ] as const) {
      const res = await handleRequest(req(path, { method }), env, () =>
        relay(),
      );
      expect(res.status).toBe(404);
    }
  });

  it('設定が不正なら503', async () => {
    const res = await handleRequest(
      req('/status'),
      { ...env, QUAKE_ACTIVE_FROM: 'x' },
      () => relay(),
    );
    expect(res.status).toBe(503);
  });

  it('POST /dismiss は by が無い・空・255文字で400、1〜254文字は通る', async () => {
    const r = relay();
    const post = (body: string) =>
      handleRequest(req('/dismiss', { method: 'POST', body }), env, () => r);
    expect((await post('{}')).status).toBe(400);
    expect((await post('{"by":""}')).status).toBe(400);
    expect((await post('{"by":1}')).status).toBe(400);
    expect((await post('not json')).status).toBe(400);
    expect((await post(JSON.stringify({ by: 'a'.repeat(255) }))).status).toBe(
      400,
    );
    expect(r.dismiss).not.toHaveBeenCalled();
    const ok = await post(JSON.stringify({ by: 'a'.repeat(254) }));
    expect(ok.status).toBe(200);
    expect(r.dismiss).toHaveBeenCalledWith('a'.repeat(254));
  });

  it('解除のpublishに失敗したら502', async () => {
    const r = relay({
      dismiss: async () => ({ ok: false, reason: 'publish_failed' }),
    });
    const res = await handleRequest(
      req('/dismiss', { method: 'POST', body: '{"by":"x"}' }),
      env,
      () => r,
    );
    expect(res.status).toBe(502);
  });

  describe('POST /dev/inject/{channel}', () => {
    const inject = (path: string, e: object = env, token = 'secret-token') =>
      handleRequest(
        req(path, { method: 'POST', body: '{"a":1}', token }),
        e,
        () => injectRelay,
      );
    const injectRelay = relay();

    it('QUAKE_DEV_INJECT が無ければ404', async () => {
      expect((await inject('/dev/inject/p2p')).status).toBe(404);
    });
    it('設定が不正なら503', async () => {
      const res = await inject('/dev/inject/p2p', {
        QUAKE_DEV_INJECT: 'true',
      });
      expect(res.status).toBe(503);
    });
    it('有効なら認証を求め、未知の系統は400、本文はそのまま渡す', async () => {
      const on = { ...env, QUAKE_DEV_INJECT: 'true' };
      expect((await inject('/dev/inject/p2p', on, 'bad')).status).toBe(401);
      expect((await inject('/dev/inject/foo', on)).status).toBe(400);
      expect((await inject('/dev/inject/wolfxEew', on)).status).toBe(204);
      expect(injectRelay.inject).toHaveBeenCalledWith('wolfxEew', '{"a":1}');
    });
  });
});

describe('handleScheduled', () => {
  it('期間内はensureを呼ぶ', async () => {
    const r = relay();
    await handleScheduled(env, NOW, () => r);
    expect(r.ensure).toHaveBeenCalledTimes(1);
  });
  it('期間外・設定不正はDOを取得すらしない', async () => {
    const get = vi.fn(() => relay());
    await handleScheduled(env, Date.parse('2026-12-01T00:00:00+09:00'), get);
    await handleScheduled(env, Date.parse('2026-10-23T08:59:59+09:00'), get);
    await handleScheduled({ ...env, QUAKE_ACTIVE_UNTIL: '' }, NOW, get);
    expect(get).not.toHaveBeenCalled();
  });
});
