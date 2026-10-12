import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PURGE_BATCH_SIZE,
  mediaPurgeTargets,
  purgeEdgeCache,
  readPurgeConfig,
  warnIfPurgeUnconfigured,
} from './edge-purge';

const config = { zoneId: 'zone-1', token: 'tok', origin: 'https://cms.example.invalid' };
const ok = () => new Response(JSON.stringify({ success: true }), { status: 200 });

describe('mediaPurgeTargets', () => {
  it('serve はプレフィックス、file は原本と各サイズの URL を返す', () => {
    const targets = mediaPurgeTargets(config.origin, {
      id: 12,
      filename: 'a b.webp',
      sizes: { hero: { filename: 'a b-1920x1080.webp' }, card: { filename: null }, thumb: null },
    });
    expect(targets.prefixes).toEqual(['cms.example.invalid/api/media/serve/12/']);
    expect(targets.files).toEqual([
      'https://cms.example.invalid/api/media/file/a%20b.webp',
      'https://cms.example.invalid/api/media/file/a%20b-1920x1080.webp',
    ]);
  });

  it('ファイル名が無ければ file は空', () => {
    expect(mediaPurgeTargets(config.origin, { id: 1 }).files).toEqual([]);
  });
});

describe('readPurgeConfig', () => {
  it('3 つとも揃っているときだけ返し、末尾スラッシュを落とす', () => {
    const env = { CLOUDFLARE_ZONE_ID: 'z', CLOUDFLARE_PURGE_TOKEN: 't', CMS_PUBLIC_URL: 'https://x.invalid/' };
    expect(readPurgeConfig(env)).toEqual({ zoneId: 'z', token: 't', origin: 'https://x.invalid' });
    expect(readPurgeConfig({ ...env, CLOUDFLARE_PURGE_TOKEN: '' })).toBeNull();
    expect(readPurgeConfig({})).toBeNull();
  });
});

describe('warnIfPurgeUnconfigured', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('未設定の警告は何度呼んでも 1 回だけ出る', () => {
    vi.stubEnv('CLOUDFLARE_ZONE_ID', '');
    vi.stubEnv('CLOUDFLARE_PURGE_TOKEN', '');
    vi.stubEnv('CMS_PUBLIC_URL', '');
    const log = vi.fn();
    warnIfPurgeUnconfigured(log);
    warnIfPurgeUnconfigured(log);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('CLOUDFLARE_PURGE_TOKEN');
  });
});

describe('purgeEdgeCache', () => {
  it('files と prefixes を別リクエストにし、認証ヘッダを付ける', async () => {
    const fetchMock = vi.fn(async () => ok());
    await purgeEdgeCache(config, { files: ['https://a.invalid/1'], prefixes: ['a.invalid/p/'] }, fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({ files: ['https://a.invalid/1'] });
    expect(JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toEqual({
      prefixes: ['a.invalid/p/'],
    });
  });

  it('上限を超える件数は 100 件ずつに分割する', async () => {
    const fetchMock = vi.fn(async () => ok());
    const files = Array.from({ length: PURGE_BATCH_SIZE * 2 + 1 }, (_, i) => `https://a.invalid/${i}`);
    await purgeEdgeCache(config, { files, prefixes: [] }, fetchMock);
    const sizes = fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string).files.length);
    expect(sizes).toEqual([100, 100, 1]);
  });

  it('対象が空なら何も送らない', async () => {
    const fetchMock = vi.fn(async () => ok());
    await purgeEdgeCache(config, { files: [], prefixes: [] }, fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('HTTP エラーや success:false は throw する (ジョブの再試行に回すため)', async () => {
    const rateLimited = vi.fn(async () => new Response('{"success":false,"errors":[{"code":1015}]}', { status: 429 }));
    await expect(purgeEdgeCache(config, { files: ['u'], prefixes: [] }, rateLimited)).rejects.toThrow('429');
    const refused = vi.fn(async () => new Response('{"success":false}', { status: 200 }));
    await expect(purgeEdgeCache(config, { files: ['u'], prefixes: [] }, refused)).rejects.toThrow();
  });
});
