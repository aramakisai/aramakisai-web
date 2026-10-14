import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFestivalMeta, getContactFormUrl } from './festival-meta';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('getFestivalMeta', () => {
  it('site_settings を取得して FestivalMeta へ変換する', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: {
        name: '荒牧祭',
        event_days: [
          {
            label: '1日目',
            start_at: '2026-09-27T00:00:00.000Z',
            end_at: '2026-09-27T08:00:00.000Z',
          },
        ],
        overview_html: '<p>概要</p>',
        og_image: { id: 456, filename: 'og.webp', mimeType: 'image/webp' },
        sns_links: [{ platform: 'x', url: 'https://x.com/example' }],
      },
    } as never);

    const result = await getFestivalMeta();

    expect(cms.findGlobal).toHaveBeenCalledWith('site_settings');
    expect(result).toEqual({
      name: '荒牧祭',
      eventDays: [
        {
          label: '1日目',
          startAt: '2026-09-27T00:00:00.000Z',
          endAt: '2026-09-27T08:00:00.000Z',
        },
      ],
      overviewHtml: '<p>概要</p>',
      ogImageId: '456',
      snsLinks: [{ platform: 'x', url: 'https://x.com/example' }],
    });
  });

  it('event_days / overview / og_image が null でも既定値へ落とす', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: {
        name: null,
        event_days: null,
        overview_html: null,
        og_image: null,
        sns_links: null,
      },
    } as never);

    expect(await getFestivalMeta()).toEqual({
      name: '',
      eventDays: [],
      overviewHtml: null,
      ogImageId: null,
      snsLinks: [],
    });
  });

  it('取得に失敗した場合は例外を投げる', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    await expect(getFestivalMeta()).rejects.toThrow();
  });
});

describe('getContactFormUrl', () => {
  it('contact_form_url を返す', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: { contact_form_url: 'https://forms.example.com/contact' },
    } as never);

    expect(await getContactFormUrl()).toBe('https://forms.example.com/contact');
  });

  it('contact_form_url が未設定なら null を返す', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: { contact_form_url: null },
    } as never);

    expect(await getContactFormUrl()).toBeNull();
  });

  it('CMS へ到達できない場合は null を返す', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 0 },
    } as never);

    expect(await getContactFormUrl()).toBeNull();
  });
});
