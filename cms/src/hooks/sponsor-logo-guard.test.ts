import { APIError } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { Media } from '../collections/media';
import { purgeEdgeCacheAfterDelete } from './media-edge-purge';
import { guardSponsorLogo } from './sponsor-logo-guard';

describe('協賛ロゴ削除ガード', () => {
  it('既存フックを保持して削除前フックを登録する', () => {
    expect(Media.hooks?.beforeDelete).toContain(guardSponsorLogo);
    expect(Media.hooks?.beforeOperation).toHaveLength(1);
    expect(Media.hooks?.afterDelete).toContain(purgeEdgeCacheAfterDelete);
  });

  it.each([1, 2])('参照が %i 件ある場合、公開可能なエラーで削除を拒否する', async (totalDocs) => {
    const count = vi.fn().mockResolvedValue({ totalDocs });
    const req = { payload: { count } };
    const error = await guardSponsorLogo({ id: 42, req } as never).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toMatchObject({ status: 400, isPublic: true });
    expect(count).toHaveBeenCalledWith({
      collection: 'sponsors', where: { logo: { equals: 42 } }, overrideAccess: true, req,
    });
  });

  it('未参照の画像は拒否しない', async () => {
    const count = vi.fn().mockResolvedValue({ totalDocs: 0 });
    const req = { payload: { count } };
    await expect(guardSponsorLogo({ id: '42', req } as never)).resolves.toBeUndefined();
    expect(count).toHaveBeenCalledWith({
      collection: 'sponsors', where: { logo: { equals: '42' } }, overrideAccess: true, req,
    });
  });

  it('参照数の取得に失敗した場合は削除を続けない', async () => {
    const error = new Error('count failed');
    const req = { payload: { count: vi.fn().mockRejectedValue(error) } };
    await expect(guardSponsorLogo({ id: 42, req } as never)).rejects.toBe(error);
  });
});
