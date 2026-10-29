import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BoothPage, {
  generateMetadata,
  generateStaticParams,
  revalidate,
} from './page';
import { getCorporateBoothDetail } from '@/lib/corporate-booths';
import type { CorporateBoothDetail } from '@/lib/exhibitions';
import { getCampusMapAreas } from '@/lib/campus-map';
import { getEventDayList } from '@/lib/timetable';
import { resolveExhibition } from '@/lib/exhibition-detail-page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/corporate-booths', () => ({
  getCorporateBoothDetail: vi.fn(),
}));

vi.mock('@/lib/campus-map', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/campus-map')>()),
  getCampusMapAreas: vi.fn(),
}));

vi.mock('@/lib/timetable', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/timetable')>()),
  getEventDayList: vi.fn(),
}));

vi.mock('@/lib/use-motion-preference', () => ({
  useMotionPreference: () => ({ reduced: false, toggle: vi.fn() }),
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null, width?: number) =>
    id ? `https://cms.example.com/assets/${id}/${width}` : null,
}));

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'https://cms.example.com',
    NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com',
  },
}));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(async () => ({
    siteTitle: '荒牧祭',
    description: '荒牧祭公式サイト',
    ogImageUrl: null,
    festival: null,
  })),
}));

const booth: CorporateBoothDetail = {
  id: 7,
  category: 'booth',
  displayName: 'たこ焼きブース',
  organizationName: '株式会社テスト',
  location: null,
  areaIds: [],
  thumbnail: { id: '42', alt: 'たこ焼きブース' },
  description: '焼きたてを提供します',
  images: [{ id: '42', alt: 'たこ焼きブース' }],
  links: [{ platform: 'website', url: 'https://example.com' }],
  categories: ['booth'],
  openDayKeys: ['2026-10-25', '2026-10-24'],
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('CorporateBoothPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCorporateBoothDetail).mockResolvedValue({
      kind: 'found',
      value: booth,
    });
    vi.mocked(getCampusMapAreas).mockResolvedValue({
      kind: 'loaded',
      value: [],
    });
    vi.mocked(getEventDayList).mockResolvedValue([
      { key: '2026-10-24', label: '1日目' },
      { key: '2026-10-25', label: '2日目' },
    ] as never);
  });

  it('企画名・企業名・出店日を表示し、スタンプ取得とブックマークは出さない', async () => {
    render(await BoothPage(params('7')));

    expect(
      screen.getByRole('heading', { name: 'たこ焼きブース' }),
    ).toBeInTheDocument();
    expect(screen.getByText('株式会社テスト')).toBeInTheDocument();
    expect(screen.getByText('企業ブース')).toBeInTheDocument();
    expect(screen.getByText('1日目・2日目')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ブックマーク/ })).toBeNull();
    expect(screen.queryByText(/スタンプ/)).toBeNull();
    expect(
      screen.getByRole('link', { name: /企画一覧へ戻る/ }),
    ).toHaveAttribute('href', '/exhibitions');
  });

  it('パンくずの構造化データを出す', async () => {
    const { container } = render(await BoothPage(params('7')));
    const json = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(json?.textContent ?? '{}');
    expect(data.itemListElement.map((e: { name: string }) => e.name)).toEqual([
      'トップ',
      '企画一覧',
      'たこ焼きブース',
    ]);
    expect(data.itemListElement[2].item).toBe(
      'https://aramakisai.example.com/exhibitions/booth/7',
    );
  });

  it('missing は 404', async () => {
    vi.mocked(getCorporateBoothDetail).mockResolvedValue({ kind: 'missing' });
    await expect(BoothPage(params('abc'))).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(generateMetadata(params('abc'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('取得失敗・エリア取得失敗・開催日程取得失敗は例外にする', async () => {
    vi.mocked(getCorporateBoothDetail).mockResolvedValue({
      kind: 'error',
      error: { kind: 'network', message: 'x' } as never,
    });
    await expect(BoothPage(params('7'))).rejects.toThrow();

    vi.mocked(getCorporateBoothDetail).mockResolvedValue({
      kind: 'found',
      value: booth,
    });
    vi.mocked(getCampusMapAreas).mockResolvedValue({
      kind: 'error',
      error: { kind: 'network', message: 'x' } as never,
    });
    await expect(BoothPage(params('7'))).rejects.toThrow();

    vi.mocked(getCampusMapAreas).mockResolvedValue({
      kind: 'loaded',
      value: [],
    });
    vi.mocked(getEventDayList).mockResolvedValue(null);
    await expect(BoothPage(params('7'))).rejects.toThrow();
  });

  it('メタデータは企画名・説明文・正規 URL・OGP 画像を学生企画と同じ規則で出す', async () => {
    const metadata = await generateMetadata(params('007'));
    expect(metadata.title).toBe('たこ焼きブース');
    expect(metadata.description).toBe('焼きたてを提供します');
    expect(metadata.alternates).toEqual({
      canonical: '/exhibitions/booth/7',
    });
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      images: [{ url: 'https://cms.example.com/assets/42/960' }],
    });
  });

  it('学生企画の詳細ルートは booth を id として解釈しない', async () => {
    expect(await resolveExhibition('booth', '7')).toEqual({ kind: 'missing' });
  });

  it('ISR 設定', () => {
    expect(generateStaticParams()).toEqual([]);
    expect(revalidate).toBe(300);
  });
});
