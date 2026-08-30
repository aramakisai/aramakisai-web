import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFestivalMeta, getContactFormUrl } from './festival-meta';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('getFestivalMeta', () => {
  it('festival_meta を取得して FestivalOverview へ変換する', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: {
        name: '荒牧祭',
        event_days: [{ label: '1日目', open: '09:00', close: '17:00' }],
        overview_html: '<p>概要</p>',
        hero_image: { id: 123, filename: 'hero.webp', mimeType: 'image/webp' },
      },
    } as never);

    const result = await getFestivalMeta();

    expect(cms.findGlobal).toHaveBeenCalledWith('festival_meta', { depth: 1 });
    expect(result).toEqual({
      name: '荒牧祭',
      eventDays: [{ label: '1日目', open: '09:00', close: '17:00' }],
      overviewHtml: '<p>概要</p>',
      heroImageId: '123',
    });
  });

  it('event_days / overview / hero_image が null でも既定値へ落とす', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: {
        name: null,
        event_days: null,
        overview_html: null,
        hero_image: null,
      },
    } as never);

    expect(await getFestivalMeta()).toEqual({
      name: '',
      eventDays: [],
      overviewHtml: null,
      heroImageId: null,
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
