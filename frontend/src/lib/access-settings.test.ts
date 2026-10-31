import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccessSettings } from './access-settings';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('getAccessSettings', () => {
  it('site_settings のアクセスタブを既定のキャッシュで取得して返す', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: {
        access_summary: '案内文',
        access_content_html: '<p>本文</p>',
        access_embed_url: 'https://example.com/map',
        access_embed_height: 480,
      },
    } as never);

    expect(await getAccessSettings()).toEqual({
      summary: '案内文',
      contentHtml: '<p>本文</p>',
      embedUrl: 'https://example.com/map',
      embedHeight: 480,
    });
    expect(cms.findGlobal).toHaveBeenCalledWith('site_settings');
  });

  it('未設定の項目は空文字・null に落とす', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: {},
    } as never);

    expect(await getAccessSettings()).toEqual({
      summary: '',
      contentHtml: '',
      embedUrl: null,
      embedHeight: null,
    });
  });

  it('取得に失敗したら throw する', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    await expect(getAccessSettings()).rejects.toThrow();
  });
});
