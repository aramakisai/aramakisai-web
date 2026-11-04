import { describe, expect, it, vi } from 'vitest';

const openNextFetch = vi.hoisted(() =>
  vi.fn(async () => new Response('next', { status: 200 })),
);
vi.mock('../.open-next/worker.js', () => ({
  default: { fetch: openNextFetch },
}));

import entry, { type SiteEntryEnv } from './site-entry';

function setup() {
  const stub = {
    fetch: vi.fn(async () => new Response('hub', { status: 200 })),
    notify: vi.fn(async () => {}),
    stats: vi.fn(async () => ({
      at: '2026-11-04T00:00:00.000Z',
      connections: { prod: 2, dev: 0, preview: 1, unknown: 3 },
    })),
  };
  const env: SiteEntryEnv = {
    STAMP_ENV: 'prod',
    SIGNAGE_HUB: { idFromName: vi.fn(() => 'id'), get: vi.fn(() => stub) },
  };
  const call = (request: Request) => entry.fetch(request, env, {});
  return { stub, env, call };
}

const ws = (headers: Record<string, string> = {}) =>
  new Request('https://aramakisai.com/api/signage/ws', {
    headers: {
      Upgrade: 'websocket',
      Origin: 'https://aramakisai.com',
      ...headers,
    },
  });

const notify = (body: unknown, method = 'POST') =>
  new Request('https://aramakisai.com/api/signage/notify', {
    method,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

describe('site-entry /api/signage/ws', () => {
  it('upgradeでなければ426', async () => {
    const { call, stub } = setup();
    const res = await call(
      new Request('https://aramakisai.com/api/signage/ws', {
        headers: { Origin: 'https://aramakisai.com' },
      }),
    );
    expect(res.status).toBe(426);
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('Originがホストと違えば403', async () => {
    const { call, stub } = setup();
    expect((await call(ws({ Origin: 'https://evil.example' }))).status).toBe(
      403,
    );
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('Originが無ければ403', async () => {
    const { call } = setup();
    const req = new Request('https://aramakisai.com/api/signage/ws', {
      headers: { Upgrade: 'websocket' },
    });
    expect((await call(req)).status).toBe(403);
  });

  it('正しい要求はハブの固定名のDOへそのまま渡し応答を返す', async () => {
    const { call, stub, env } = setup();
    const res = await call(ws());
    expect(res.status).toBe(200);
    expect(stub.fetch).toHaveBeenCalledTimes(1);
    expect(env.SIGNAGE_HUB.idFromName).toHaveBeenCalledWith('signage-hub');
  });

  it('クライアントの X-Signage-Origin を捨て、STAMP_ENV の値をハブへ渡す', async () => {
    const { call, stub } = setup();
    await call(ws({ 'X-Signage-Origin': 'dev' }));
    const passed = (stub.fetch.mock.calls[0] as unknown as [Request])[0];
    expect(passed.headers.get('X-Signage-Origin')).toBe('prod');
    expect(passed.headers.get('Upgrade')).toBe('websocket');
  });

  it.each([[undefined], ['staging']])(
    'STAMP_ENV が %s なら unknown を渡す',
    async (value) => {
      const { call, stub, env } = setup();
      (env as { STAMP_ENV?: string }).STAMP_ENV = value;
      await call(ws({ 'X-Signage-Origin': 'prod' }));
      const passed = (stub.fetch.mock.calls[0] as unknown as [Request])[0];
      expect(passed.headers.get('X-Signage-Origin')).toBe('unknown');
    },
  );
});

describe('site-entry /api/signage/stats', () => {
  it('GET でハブの stats を JSON で返す', async () => {
    const { call } = setup();
    const res = await call(
      new Request('https://aramakisai.com/api/signage/stats'),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(await res.json()).toEqual({
      at: '2026-11-04T00:00:00.000Z',
      connections: { prod: 2, dev: 0, preview: 1, unknown: 3 },
    });
  });

  it('GET 以外は 405', async () => {
    const { call, stub } = setup();
    const res = await call(
      new Request('https://aramakisai.com/api/signage/stats', {
        method: 'POST',
      }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
    expect(stub.stats).not.toHaveBeenCalled();
  });
});

describe('site-entry /api/signage/notify', () => {
  it('POST以外は405', async () => {
    const { call, stub } = setup();
    expect((await call(notify(null, 'GET'))).status).toBe(405);
    expect(stub.notify).not.toHaveBeenCalled();
  });

  it('正しいtargetsでハブのnotifyを呼び204', async () => {
    const { call, stub } = setup();
    const res = await call(notify({ targets: ['pin', 'snapshot'] }));
    expect(res.status).toBe(204);
    expect(stub.notify).toHaveBeenCalledWith(['pin', 'snapshot']);
  });

  it.each([
    ['targetsが無い', {}],
    ['空配列', { targets: [] }],
    ['未知の値', { targets: ['pin', 'x'] }],
    ['配列でない', { targets: 'pin' }],
  ])('%sなら400', async (_name, body) => {
    const { call, stub } = setup();
    expect((await call(notify(body))).status).toBe(400);
    expect(stub.notify).not.toHaveBeenCalled();
  });

  it('JSONでない本文は400', async () => {
    const { call } = setup();
    const req = new Request('https://aramakisai.com/api/signage/notify', {
      method: 'POST',
      body: 'not json',
    });
    expect((await call(req)).status).toBe(400);
  });
});

describe('site-entry その他のパス', () => {
  it('OpenNextへ渡す', async () => {
    const { call, stub } = setup();
    const req = new Request('https://aramakisai.com/api/signage/pin');
    const res = await call(req);
    expect(await res.text()).toBe('next');
    expect(openNextFetch).toHaveBeenCalled();
    expect(stub.fetch).not.toHaveBeenCalled();
  });
});

describe('site-entry /2025 プロキシ', () => {
  it('/2025 と /2025/ 配下だけ旧サーバーへ転送し、/20250 は Next に流す', async () => {
    const upstream = vi.fn(async () => new Response('old', { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const { call } = setup();
    for (const p of ['/2025', '/2025/', '/2025/about?x=1']) {
      expect(
        await (await call(new Request(`https://aramakisai.com${p}`))).text(),
      ).toBe('old');
    }
    expect(upstream).toHaveBeenCalledTimes(3);
    expect(upstream.mock.calls[0]).toMatchObject([
      expect.any(Request),
      { cf: { resolveOverride: 'origin-2025.aramakisai.com' } },
    ]);
    for (const p of ['/20250', '/2025x', '/x/2025']) {
      expect(
        await (await call(new Request(`https://aramakisai.com${p}`))).text(),
      ).toBe('next');
    }
    expect(upstream).toHaveBeenCalledTimes(3);
    const proxied = await call(new Request('https://aramakisai.com/2025'));
    expect(proxied.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(proxied.status).toBe(200);
    vi.unstubAllGlobals();
  });
});
