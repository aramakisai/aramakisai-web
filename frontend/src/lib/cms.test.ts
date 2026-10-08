import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildQueryString, cms } from './cms';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:3100' },
}));

describe('buildQueryString', () => {
  it('where をブラケット記法へ展開する', () => {
    expect(
      buildQueryString({
        where: { published_at: { less_than_equal: '2026-01-01' } },
      }),
    ).toBe('where%5Bpublished_at%5D%5Bless_than_equal%5D=2026-01-01');
  });

  it('sort と limit と depth を並べる', () => {
    expect(
      buildQueryString({ sort: ['-published_at'], limit: 0, depth: 2 }),
    ).toBe('sort=-published_at&limit=0&depth=2');
  });

  it('and / or を配列添字付きで展開する', () => {
    expect(
      buildQueryString({
        where: { or: [{ status: { equals: 'published' } }] },
      }),
    ).toBe('where%5Bor%5D%5B0%5D%5Bstatus%5D%5Bequals%5D=published');
  });

  it('条件がなければ空文字を返す', () => {
    expect(buildQueryString({})).toBe('');
  });
});

describe('cms.findMany', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('成功時は docs を返す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ docs: [{ id: 1 }], totalDocs: 1 }),
      }),
    );
    const result = await cms.findMany('announcements', {});
    expect(result).toEqual({
      ok: true,
      value: { docs: [{ id: 1 }], totalDocs: 1 },
    });
  });

  it('404 は not_found として返す', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
    );
    expect(await cms.findMany('announcements', {})).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
  });

  it('403 は unauthorized として返す', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
    );
    expect(await cms.findMany('announcements', {})).toEqual({
      ok: false,
      error: { kind: 'unauthorized' },
    });
  });

  it('通信例外は network として返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    expect(await cms.findMany('announcements', {})).toEqual({
      ok: false,
      error: { kind: 'network', status: 0 },
    });
  });
});

describe('cms.findGlobal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('globals パスを叩く', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await cms.findGlobal('festival_meta', { depth: 1 });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3100/api/globals/festival_meta?depth=1',
    );
  });
});

describe('cms キャッシュ', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as Record<symbol, unknown>)[
      Symbol.for('__cloudflare-context__')
    ];
  });

  const okResponse = () =>
    new Response(JSON.stringify({ docs: [], totalDocs: 0 }), { status: 200 });

  it('caches 未定義ならそのまま fetch する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('caches', undefined);
    vi.stubGlobal('fetch', fetchMock);
    expect((await cms.findMany('announcements', {})).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches.default が無ければそのまま fetch する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('caches', {});
    vi.stubGlobal('fetch', fetchMock);
    expect((await cms.findMany('announcements', {})).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ttlSeconds 0 はキャッシュを参照も保存もせず no-store で取得する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const match = vi.fn();
    const put = vi.fn();
    vi.stubGlobal('caches', { default: { match, put } });
    vi.stubGlobal('fetch', fetchMock);
    await cms.findGlobal('signage_settings', {}, { ttlSeconds: 0 });
    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), {
      cache: 'no-store',
    });
  });

  it('ヒット時は fetch せずキャッシュを返す', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('caches', {
      default: { match: vi.fn().mockResolvedValue(okResponse()), put: vi.fn() },
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await cms.findMany('announcements', {})).ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ミスの 2xx は s-maxage=60 付きで put する', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const waitUntil = vi.fn();
    vi.stubGlobal('caches', {
      default: { match: vi.fn().mockResolvedValue(undefined), put },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    (globalThis as Record<symbol, unknown>)[
      Symbol.for('__cloudflare-context__')
    ] = { ctx: { waitUntil } };
    const result = await cms.findMany('announcements', {});
    expect(result.ok).toBe(true);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1].headers.get('Cache-Control')).toBe(
      's-maxage=60',
    );
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('ttlSeconds 指定時はその TTL で put し、既定 TTL とキーを共有しない', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const match = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('caches', { default: { match, put } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => okResponse()),
    );
    (globalThis as Record<symbol, unknown>)[
      Symbol.for('__cloudflare-context__')
    ] = { ctx: { waitUntil: vi.fn() } };
    await cms.findMany('announcements', {}, { ttlSeconds: 20 });
    await cms.findMany('announcements', {});
    expect(put.mock.calls[0][1].headers.get('Cache-Control')).toBe(
      's-maxage=20',
    );
    expect(put.mock.calls[1][1].headers.get('Cache-Control')).toBe(
      's-maxage=60',
    );
    expect(match.mock.calls[0][0].url).not.toBe(match.mock.calls[1][0].url);
  });

  it('findGlobal も ttlSeconds 指定時はその TTL で put する', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('caches', {
      default: { match: vi.fn().mockResolvedValue(undefined), put },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => okResponse()),
    );
    (globalThis as Record<symbol, unknown>)[
      Symbol.for('__cloudflare-context__')
    ] = { ctx: { waitUntil: vi.fn() } };
    await cms.findGlobal('festival_meta', {}, { ttlSeconds: 15 });
    await cms.findGlobal('festival_meta');
    expect(put.mock.calls[0][1].headers.get('Cache-Control')).toBe(
      's-maxage=15',
    );
    expect(put.mock.calls[1][1].headers.get('Cache-Control')).toBe(
      's-maxage=60',
    );
  });

  it('非 2xx は put しない', async () => {
    const put = vi.fn();
    vi.stubGlobal('caches', {
      default: { match: vi.fn().mockResolvedValue(undefined), put },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('x', { status: 500 })),
    );
    const result = await cms.findMany('announcements', {});
    expect(result).toEqual({
      ok: false,
      error: { kind: 'network', status: 500 },
    });
    expect(put).not.toHaveBeenCalled();
  });
});
