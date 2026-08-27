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
    expect(buildQueryString({ sort: ['-published_at'], limit: 0, depth: 2 })).toBe(
      'sort=-published_at&limit=0&depth=2',
    );
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
    expect(result).toEqual({ ok: true, value: { docs: [{ id: 1 }], totalDocs: 1 } });
  });

  it('404 は not_found として返す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
    );
    expect(await cms.findMany('announcements', {})).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
  });

  it('403 は unauthorized として返す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
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
