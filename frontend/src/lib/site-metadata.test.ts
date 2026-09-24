import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSiteMetadata,
  FALLBACK_SITE_TITLE,
  FALLBACK_SITE_DESCRIPTION,
} from './site-metadata';
import { getFestivalMeta } from './festival-meta';
import type { FestivalMeta } from './home-page-types';

vi.mock('./festival-meta', () => ({ getFestivalMeta: vi.fn() }));
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:3100' },
}));

const BASE_FESTIVAL: FestivalMeta = {
  name: '荒牧祭',
  eventDays: [],
  overviewHtml: null,
  heroImageId: null,
  siteTitle: null,
  metaDescription: null,
  ogImageId: null,
  venueName: null,
  venueAddress: null,
  snsLinks: [],
};

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string) {
  vi.stubEnv('NODE_ENV', value);
}

beforeEach(() => {
  vi.clearAllMocks();
  setNodeEnv(originalNodeEnv ?? 'test');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getSiteMetadata', () => {
  it('site_title があればそれをタイトルに使う', async () => {
    setNodeEnv('production');
    vi.mocked(getFestivalMeta).mockResolvedValue({
      ...BASE_FESTIVAL,
      name: '荒牧祭本祭',
      siteTitle: '荒牧祭 公式サイト',
    });

    const result = await getSiteMetadata();

    expect(result.siteTitle).toBe('荒牧祭 公式サイト');
  });

  it('site_title が無ければ祭名を使う', async () => {
    setNodeEnv('production');
    vi.mocked(getFestivalMeta).mockResolvedValue({
      ...BASE_FESTIVAL,
      name: '荒牧祭本祭',
      siteTitle: null,
    });

    const result = await getSiteMetadata();

    expect(result.siteTitle).toBe('荒牧祭本祭');
  });

  it('site_title も祭名も無ければ固定値「荒牧祭」を使う', async () => {
    setNodeEnv('production');
    vi.mocked(getFestivalMeta).mockResolvedValue({
      ...BASE_FESTIVAL,
      name: '',
      siteTitle: null,
    });

    const result = await getSiteMetadata();

    expect(result.siteTitle).toBe(FALLBACK_SITE_TITLE);
  });

  it('開発環境では決定したタイトルの前に【開発環境】を前置する', async () => {
    setNodeEnv('development');
    vi.mocked(getFestivalMeta).mockResolvedValue({
      ...BASE_FESTIVAL,
      name: '荒牧祭本祭',
      siteTitle: null,
    });

    const result = await getSiteMetadata();

    expect(result.siteTitle).toBe('【開発環境】 荒牧祭本祭');
  });

  it('本番環境では前置しない', async () => {
    setNodeEnv('production');
    vi.mocked(getFestivalMeta).mockResolvedValue({
      ...BASE_FESTIVAL,
      name: '荒牧祭本祭',
    });

    const result = await getSiteMetadata();

    expect(result.siteTitle.startsWith('【開発環境】')).toBe(false);
  });

  it('meta_description があればそれを説明文に使う', async () => {
    vi.mocked(getFestivalMeta).mockResolvedValue({
      ...BASE_FESTIVAL,
      metaDescription: 'CMS で設定した説明文',
      overviewHtml: '<p>概要文</p>',
    });

    const result = await getSiteMetadata();

    expect(result.description).toBe('CMS で設定した説明文');
  });

  it('meta_description が無ければ祭概要を正規化して使う', async () => {
    vi.mocked(getFestivalMeta).mockResolvedValue({
      ...BASE_FESTIVAL,
      metaDescription: null,
      overviewHtml: '<p>祭の概要です</p>',
    });

    const result = await getSiteMetadata();

    expect(result.description).toBe('祭の概要です');
  });

  it('meta_description も祭概要も無ければ固定値を使う', async () => {
    vi.mocked(getFestivalMeta).mockResolvedValue({
      ...BASE_FESTIVAL,
      metaDescription: null,
      overviewHtml: null,
    });

    const result = await getSiteMetadata();

    expect(result.description).toBe(FALLBACK_SITE_DESCRIPTION);
  });

  it('og_image があれば配信 URL に解決する', async () => {
    vi.mocked(getFestivalMeta).mockResolvedValue({
      ...BASE_FESTIVAL,
      ogImageId: '456',
    });

    const result = await getSiteMetadata();

    expect(result.ogImageUrl).toContain('456');
  });

  it('og_image が無ければ null を返す', async () => {
    vi.mocked(getFestivalMeta).mockResolvedValue({
      ...BASE_FESTIVAL,
      ogImageId: null,
    });

    const result = await getSiteMetadata();

    expect(result.ogImageUrl).toBeNull();
  });

  it('festival に取得結果をそのまま保持する (構造化データ用)', async () => {
    const festival: FestivalMeta = { ...BASE_FESTIVAL, name: '荒牧祭本祭' };
    vi.mocked(getFestivalMeta).mockResolvedValue(festival);

    const result = await getSiteMetadata();

    expect(result.festival).toEqual(festival);
  });

  it('CMS 取得が例外を投げても既定値へ退避し、例外を外へ出さない', async () => {
    setNodeEnv('production');
    vi.mocked(getFestivalMeta).mockRejectedValue(new Error('network error'));

    const result = await getSiteMetadata();

    expect(result).toEqual({
      siteTitle: FALLBACK_SITE_TITLE,
      description: FALLBACK_SITE_DESCRIPTION,
      ogImageUrl: null,
      festival: null,
    });
  });
});
