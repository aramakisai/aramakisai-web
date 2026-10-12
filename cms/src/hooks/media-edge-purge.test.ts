import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Media } from '../payload-types';
import { purgeEdgeCacheAfterChange, purgeEdgeCacheAfterDelete } from './media-edge-purge';

const queue = vi.fn(async (_args: unknown) => ({}));
const req = { payload: { jobs: { queue } } } as never;

const media = (over: Partial<Media> = {}): Media =>
  ({
    id: 7,
    filename: 'm.webp',
    sizes: { hero: { filename: 'm-hero.webp' } },
    used_in_published: true,
    ...over,
  }) as Media;

const change = (doc: Media, previousDoc: Media | undefined, operation: 'update' | 'create' = 'update') =>
  purgeEdgeCacheAfterChange({ doc, previousDoc, operation, req, context: {}, collection: {} as never } as never);

beforeEach(() => {
  queue.mockClear();
  vi.stubEnv('CLOUDFLARE_ZONE_ID', 'z');
  vi.stubEnv('CLOUDFLARE_PURGE_TOKEN', 't');
  vi.stubEnv('CMS_PUBLIC_URL', 'https://cms.example.invalid');
});
afterEach(() => vi.unstubAllEnvs());

const queuedInput = () => (queue.mock.calls[0][0] as { input: { files: string[]; prefixes: string[] } }).input;

describe('purgeEdgeCacheAfterChange', () => {
  it.each([
    ['true -> false', true, false],
    ['null -> false', null, false],
  ])('公開から非公開 (%s) で旧 URL の purge を積む', async (_label, before, after) => {
    await change(media({ used_in_published: after }), media({ used_in_published: before }));
    expect(queue).toHaveBeenCalledTimes(1);
    expect(queuedInput().prefixes).toEqual(['cms.example.invalid/api/media/serve/7/']);
    expect(queuedInput().files).toEqual([
      'https://cms.example.invalid/api/media/file/m.webp',
      'https://cms.example.invalid/api/media/file/m-hero.webp',
    ]);
  });

  it.each([
    ['false -> false', false, false],
    ['false -> true', false, true],
    ['true -> true', true, true],
    ['null -> true', null, true],
  ])('露出が減らない変化 (%s) では積まない', async (_label, before, after) => {
    await change(media({ used_in_published: after }), media({ used_in_published: before }));
    expect(queue).not.toHaveBeenCalled();
  });

  it('公開のままファイルが差し替わったら旧ファイルを purge する', async () => {
    await change(
      media({ filename: 'new.webp', sizes: { hero: { filename: 'new-hero.webp' } } }),
      media(),
    );
    expect(queuedInput().files).toContain('https://cms.example.invalid/api/media/file/m.webp');
    expect(queuedInput().files).not.toContain('https://cms.example.invalid/api/media/file/new.webp');
  });

  it('create や前の値が無い場合は積まない', async () => {
    await change(media({ used_in_published: false }), undefined, 'create');
    await change(media({ used_in_published: false }), undefined);
    expect(queue).not.toHaveBeenCalled();
  });

  it('設定が無ければ何も積まず、保存も失敗しない', async () => {
    vi.stubEnv('CLOUDFLARE_PURGE_TOKEN', '');
    const doc = media({ used_in_published: false });
    await expect(change(doc, media())).resolves.toBe(doc);
    expect(queue).not.toHaveBeenCalled();
  });
});

describe('purgeEdgeCacheAfterDelete', () => {
  it('公開状態 (null/true) の画像の削除で積み、非公開なら積まない', async () => {
    await purgeEdgeCacheAfterDelete({ doc: media({ used_in_published: null }), req } as never);
    expect(queue).toHaveBeenCalledTimes(1);
    queue.mockClear();
    await purgeEdgeCacheAfterDelete({ doc: media({ used_in_published: false }), req } as never);
    expect(queue).not.toHaveBeenCalled();
  });
});
