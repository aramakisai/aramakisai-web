import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notFound } from 'next/navigation';
import ExhibitionPage, { generateMetadata } from './page';
import { getExhibitionDetail } from '@/lib/exhibitions';
import type { ExhibitionDetail, ExhibitionDetailResult } from '@/lib/exhibitions';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/exhibitions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/exhibitions')>(
    '@/lib/exhibitions',
  );
  return { ...actual, getExhibitionDetail: vi.fn() };
});

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

const baseExhibition: ExhibitionDetail = {
  id: 1,
  name: 'アラマキ祭実行委員会',
  stageName: 'アラマキ祭実行委員会',
  organizationName: '実行委員会',
  categories: ['exhibit', 'stage'],
  location: '中央エリア A-1',
  areaIds: [1],
  thumbnail: { id: '42', alt: 'サムネイル' },
  description: 'たのしい企画です',
  images: [
    { id: '42', alt: 'サムネイル' },
    { id: '43', alt: '写真2' },
  ],
  links: [{ platform: 'x', url: 'https://x.com/aramaki' }],
};

function mockResult(result: ExhibitionDetailResult) {
  vi.mocked(getExhibitionDetail).mockResolvedValue(result);
}

describe('ExhibitionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('公開済みの企画情報を表示する', async () => {
    mockResult({ kind: 'found', value: baseExhibition });

    const jsx = await ExhibitionPage({ params: Promise.resolve({ id: '1' }) });
    render(jsx);

    expect(getExhibitionDetail).toHaveBeenCalledWith(1);
    expect(
      screen.getByRole('heading', { name: 'アラマキ祭実行委員会', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('実行委員会')).toBeInTheDocument();
    expect(screen.getByText('展示')).toBeInTheDocument();
    expect(screen.getByText('ステージ')).toBeInTheDocument();
    expect(screen.getByText('中央エリア A-1')).toBeInTheDocument();
    expect(screen.getByText('たのしい企画です')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '企画一覧へ戻る' })).toHaveAttribute(
      'href',
      '/exhibitions',
    );
    expect(screen.getByRole('link', { name: 'X' })).toHaveAttribute(
      'href',
      'https://x.com/aramaki',
    );
    expect(
      screen.getByRole('button', { name: /共有/ }),
    ).toBeInTheDocument();
  });

  it('存在しない ID は notFound を呼ぶ', async () => {
    mockResult({ kind: 'missing' });

    await expect(
      ExhibitionPage({ params: Promise.resolve({ id: '999' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('数値でない ID は取得せず notFound を呼ぶ', async () => {
    await expect(
      ExhibitionPage({ params: Promise.resolve({ id: 'abc' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getExhibitionDetail).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalled();
  });

  it('取得に失敗した場合は 404 にせず失敗が分かる表示をする', async () => {
    mockResult({ kind: 'error', error: { kind: 'network', status: 500 } });

    const jsx = await ExhibitionPage({ params: Promise.resolve({ id: '1' }) });
    render(jsx);

    expect(notFound).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('取得');
    expect(screen.getByRole('link', { name: '企画一覧へ戻る' })).toHaveAttribute(
      'href',
      '/exhibitions',
    );
  });

  describe('generateMetadata', () => {
    it('企画名と紹介文、画像を OGP として返す', async () => {
      mockResult({ kind: 'found', value: baseExhibition });

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '1' }),
      });

      expect(metadata.title).toBe('アラマキ祭実行委員会');
      expect(metadata.description).toBe('たのしい企画です');
      expect(metadata.openGraph?.images).toEqual([
        'https://cms.example.com/assets/42/960',
      ]);
      expect(
        (metadata.twitter as { card?: string } | undefined)?.card,
      ).toBe('summary_large_image');
    });

    it('紹介文が未入力なら代替の説明文を使う', async () => {
      mockResult({
        kind: 'found',
        value: { ...baseExhibition, description: null },
      });

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '1' }),
      });

      expect(metadata.description).toBe('実行委員会 の企画');
    });

    it('見つからない場合は既定のメタデータのみを返す', async () => {
      mockResult({ kind: 'missing' });

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '999' }),
      });

      expect(metadata).toEqual({});
    });

    it('取得に失敗した場合も既定のメタデータのみを返す', async () => {
      mockResult({ kind: 'error', error: { kind: 'network', status: 500 } });

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '1' }),
      });

      expect(metadata).toEqual({});
    });
  });
});
