import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSnsLinks } from './sns-links';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('getSnsLinks', () => {
  it('sns_links を返す', async () => {
    const mockLinks = [{ platform: 'twitter', url: 'https://twitter.com' }];
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: { sns_links: mockLinks },
    } as never);

    expect(await getSnsLinks()).toEqual(mockLinks);
  });

  it('sns_links が null なら空配列を返す', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: { sns_links: null },
    } as never);

    expect(await getSnsLinks()).toEqual([]);
  });

  it('取得に失敗した場合は空配列を返す', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 0 },
    } as never);

    expect(await getSnsLinks()).toEqual([]);
  });
});
