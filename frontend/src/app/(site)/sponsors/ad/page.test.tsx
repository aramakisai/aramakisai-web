import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvertisingSponsorsContent } from '@/components/advertising-sponsors';
import type { SponsorListItem } from '@/lib/sponsors';
import * as sponsorsModule from '@/lib/sponsors';
import * as advertisingModule from '@/lib/advertising-sponsors';
import * as siteMetadataModule from '@/lib/site-metadata';
import AdvertisingSponsorsPage, { generateMetadata, revalidate } from './page';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:3100' },
}));
vi.mock('@/lib/sponsors', () => ({ getSponsors: vi.fn() }));
vi.mock('@/lib/advertising-sponsors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/advertising-sponsors')>()),
  getPersonalSponsors: vi.fn(),
}));
vi.mock('@/lib/site-metadata', () => ({ getSiteMetadata: vi.fn() }));

const company = (id: number, name: string, tier: string): SponsorListItem => ({
  id,
  name,
  tier,
  logoId: '1',
  logoWidth: null,
  logoHeight: null,
  url: null,
});
const ad = [company(1, '企業A', 'planA'), company(2, '企業D', 'planD')];
const personal = [{ id: 10, name: '個人' }];

beforeEach(() => {
  vi.mocked(sponsorsModule.getSponsors).mockResolvedValue({
    ok: true,
    value: { ad, local: [company(3, '地域', 'planA')], vendor: [], other: [] },
  });
  vi.mocked(advertisingModule.getPersonalSponsors).mockResolvedValue(personal);
  vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue({
    siteTitle: '荒牧祭',
    description: '公式サイト',
    ogImageUrl: null,
    festival: null,
  });
  vi.stubEnv('NEXT_PHASE', 'phase-production-server');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('広告協賛ページ', () => {
  it('広告協賛だけをプラン別に分類し、個人協賛と本文へ渡す', async () => {
    const element = await AdvertisingSponsorsPage();
    expect(element.type).toBe(AdvertisingSponsorsContent);
    expect(element.props.sponsors).toEqual(
      advertisingModule.groupAdSponsors(ad),
    );
    expect(element.props.personalSponsors).toEqual(personal);
    expect(sponsorsModule.getSponsors).toHaveBeenCalledExactlyOnceWith({
      ttlSeconds: 1,
    });
    expect(
      advertisingModule.getPersonalSponsors,
    ).toHaveBeenCalledExactlyOnceWith({ ttlSeconds: 1 });
    expect(revalidate).toBe(60);
  });

  it('データが0件の場合は架空のデータを足さない', async () => {
    vi.mocked(sponsorsModule.getSponsors).mockResolvedValue({
      ok: true,
      value: { ad: [], local: [], vendor: [], other: [] },
    });
    vi.mocked(advertisingModule.getPersonalSponsors).mockResolvedValue([]);
    const element = await AdvertisingSponsorsPage();
    expect(element.props.sponsors).toEqual(
      advertisingModule.groupAdSponsors([]),
    );
    expect(element.props.personalSponsors).toEqual([]);
  });

  it('メタデータにタイトル・説明・正規URLを設定する', async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toBe('広告協賛');
    expect(metadata.description).toBe(
      '荒牧祭2026にご協賛いただいた企業・団体と個人の皆様をご紹介します。',
    );
    expect(metadata.alternates).toEqual({ canonical: '/sponsors/ad' });
  });

  it('ビルド時の企業取得失敗だけを空にし、個人一覧を維持する', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.mocked(sponsorsModule.getSponsors).mockResolvedValue({ ok: false });
    const element = await AdvertisingSponsorsPage();
    expect(element.props.sponsors).toEqual(
      advertisingModule.groupAdSponsors([]),
    );
    expect(element.props.personalSponsors).toEqual(personal);
  });

  it('ビルド時の個人取得失敗だけを空にし、企業一覧を維持する', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.mocked(advertisingModule.getPersonalSponsors).mockRejectedValue(
      new Error('個人取得失敗'),
    );
    const element = await AdvertisingSponsorsPage();
    expect(element.props.sponsors).toEqual(
      advertisingModule.groupAdSponsors(ad),
    );
    expect(element.props.personalSponsors).toEqual([]);
  });

  it('実行時の企業取得エラーを例外にする', async () => {
    vi.mocked(sponsorsModule.getSponsors).mockResolvedValue({ ok: false });
    await expect(AdvertisingSponsorsPage()).rejects.toThrow(
      'Failed to load sponsors',
    );
  });

  it('企業取得が例外を投げた場合は実行時にそのまま伝播する', async () => {
    const error = new Error('企業取得失敗');
    vi.mocked(sponsorsModule.getSponsors).mockRejectedValue(error);
    await expect(AdvertisingSponsorsPage()).rejects.toThrow(error);
  });

  it('実行時の個人取得例外を伝播する', async () => {
    const error = new Error('個人取得失敗');
    vi.mocked(advertisingModule.getPersonalSponsors).mockRejectedValue(error);
    await expect(AdvertisingSponsorsPage()).rejects.toThrow(error);
  });
});
