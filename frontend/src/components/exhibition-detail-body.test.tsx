import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExhibitionDetailBody } from './exhibition-detail-body';
import type { CorporateBoothDetail, ExhibitionDetail } from '@/lib/exhibitions';

vi.mock('@/lib/use-motion-preference', () => ({
  useMotionPreference: () => ({ reduced: false, toggle: vi.fn() }),
}));
vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) => (id ? `https://example.com/${id}` : null),
}));
vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'https://cms.example.com',
    NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com',
  },
}));

const exhibition: ExhibitionDetail = {
  id: 1,
  category: 'vendor',
  displayName: '焼きそば屋',
  organizationName: '調理部',
  categories: ['vendor'],
  location: 'ブース 12',
  areaIds: [],
  thumbnail: null,
  description: '長い紹介文',
  images: [],
  links: [{ platform: 'x', url: 'https://x.com/a' }],
  menu: Array.from({ length: 12 }, (_, i) => ({ name: `品${i}`, price: 100 })),
  openDayKeys: [],
};

describe('ExhibitionDetailBody signage', () => {
  const view = () =>
    render(
      <ExhibitionDetailBody
        exhibition={exhibition}
        areas={[]}
        performances={null}
        openDays="1日目"
        variant="signage"
      />,
    );

  it('共有・ブックマーク・外部リンクを描画しない', () => {
    view();
    expect(screen.queryByText('共有')).toBeNull();
    expect(screen.queryByRole('list', { name: 'リンク' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /ブックマーク|保存/ }),
    ).toBeNull();
  });

  it('出店メニューは全品出し、紹介文は5行で省略する', () => {
    view();
    expect(screen.getByText('品11')).toBeInTheDocument();
    expect(screen.getByText('長い紹介文')).toHaveClass(
      'line-clamp-5',
      'min-h-[190px]',
    );
  });

  it('h1 は 40px・紹介 h2 は 35px の行高を明示する', () => {
    view();
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass(
      'leading-[40px]',
    );
    expect(screen.getByRole('heading', { name: '紹介' })).toHaveClass(
      'leading-[35px]',
    );
  });

  it('3列の幅は 560・520・744', () => {
    const { container } = view();
    const cols = container.firstElementChild!.children;
    expect(cols[0]).toHaveClass('w-[560px]');
    expect(cols[1]).toHaveClass('w-[520px]');
    expect(cols[2]).toHaveClass('w-[744px]');
  });
});

describe('ExhibitionDetailBody site', () => {
  it('共有とリンクを描画する', () => {
    render(
      <ExhibitionDetailBody
        exhibition={exhibition}
        areas={[]}
        performances={null}
        openDays={null}
      />,
    );
    expect(screen.getByText('共有')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'リンク' })).toBeInTheDocument();
  });
});

describe('ExhibitionDetailBody corporate booth', () => {
  const booth: CorporateBoothDetail = {
    id: 7,
    category: 'booth',
    displayName: 'たこ焼き出店',
    organizationName: '株式会社テスト',
    categories: ['booth'],
    location: null,
    areaIds: [],
    thumbnail: null,
    description: null,
    images: [],
    links: [{ platform: 'website', url: 'https://example.com/' }],
    openDayKeys: [],
  };
  const view = () =>
    render(
      <ExhibitionDetailBody
        exhibition={booth}
        areas={[]}
        performances={null}
        openDays={null}
      />,
    );

  it('バッジ・企業名・Web サイトリンクを出す', () => {
    view();
    const badge = screen.getByText('企業ブース');
    expect(badge).toHaveClass('bg-secondary');
    expect(screen.getByText('株式会社テスト')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'リンク' })).toBeInTheDocument();
  });

  it('メニューとブックマークを出さない', () => {
    view();
    expect(screen.queryByText('メニュー')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /ブックマーク|保存/ }),
    ).toBeNull();
  });
});
