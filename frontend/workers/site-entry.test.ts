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
  };
  const env: SiteEntryEnv = {
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
    const req = ws();
    const res = await call(req);
    expect(res.status).toBe(200);
    expect(stub.fetch).toHaveBeenCalledWith(req);
    expect(env.SIGNAGE_HUB.idFromName).toHaveBeenCalledWith('signage-hub');
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
  it('旧スポンサーURLの転送応答に含まれる301とLocationを保持する', async () => {
    const upstream = vi.fn(
      async () =>
        new Response(null, {
          status: 301,
          headers: { Location: 'https://aramakisai.com/2025/sponsors/' },
        }),
    );
    vi.stubGlobal('fetch', upstream);
    try {
      const { call } = setup();
      const req = new Request('https://aramakisai.com/2025/sponsors', {
        redirect: 'manual',
      });
      const result = await call(req);
      expect(result.status).toBe(301);
      expect(result.headers.get('Location')).toBe(
        'https://aramakisai.com/2025/sponsors/',
      );
      expect(result.headers.get('X-Robots-Tag')).toBe('noindex');
      expect(upstream).toHaveBeenCalledWith(req, {
        cf: { resolveOverride: 'origin-2025.aramakisai.com' },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

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
