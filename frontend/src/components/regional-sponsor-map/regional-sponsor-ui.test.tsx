import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RegionalSponsorCategory } from '@/lib/regional-sponsor-categories';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorCard } from './regional-sponsor-card';
import { RegionalSponsorDetail } from './regional-sponsor-detail';
import { RegionalSponsorList } from './regional-sponsor-list';
import { RegionalSponsorSearch } from './regional-sponsor-search';
import { SponsorImage } from './sponsor-image';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null, width: number) =>
    id ? `https://cms.invalid/${id}?width=${width}` : null,
}));

function sponsor(overrides: Partial<RegionalSponsor> = {}): RegionalSponsor {
  return {
    id: 1,
    name: 'テスト専用地域協賛',
    category: 'shop',
    latitude: 36.4,
    longitude: 139.1,
    address: 'テスト県テスト市1-2-3',
    imageId: 'fixture-image',
    imageAlt: 'テスト専用掲載画像',
    imageDecorative: false,
    message: '応援メッセージ\n2行目',
    businessHours: '午前 9時〜12時\n午後 14時〜18時',
    closedDays: '日曜日',
    phone: '000-0000-0000',
    websiteUrl: 'https://example.invalid/',
    order: 0,
    ...overrides,
  };
}

describe('SponsorImage / RegionalSponsorCard', () => {
  it('同じ画像IDを用途別幅で取得し、全体をcontainで表示する', () => {
    const { rerender } = render(
      <SponsorImage sponsor={sponsor()} variant="card" className="h-20 w-20" />,
    );
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://cms.invalid/fixture-image?width=160',
    );
    expect(screen.getByRole('img')).toHaveClass('object-contain');
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('img')).toHaveAttribute('decoding', 'async');

    rerender(<SponsorImage sponsor={sponsor()} variant="detail" />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://cms.invalid/fixture-image?width=720',
    );
  });

  it('画像未登録と読込失敗を共通placeholderへ切り替え、装飾画像は空altにする', () => {
    const { container, rerender } = render(
      <SponsorImage sponsor={sponsor({ imageId: null })} variant="card" />,
    );
    expect(screen.getByLabelText(/画像はありません/)).toBeInTheDocument();

    rerender(<SponsorImage sponsor={sponsor()} variant="card" />);
    fireEvent.error(screen.getByRole('img'));
    expect(
      screen.queryByRole('img', { name: 'テスト専用掲載画像' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('sponsor-image-placeholder')).toBeInTheDocument();

    rerender(
      <SponsorImage
        sponsor={sponsor({
          imageId: 'decorative-fixture',
          imageDecorative: true,
          imageAlt: null,
        })}
        variant="card"
      />,
    );
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it.each<[RegionalSponsorCategory, string]>([
    ['hospital', '病院'],
    ['life', '生活'],
    ['car', '車'],
    ['education', '教育'],
    ['food', '飲食'],
    ['shop', 'ショップ'],
  ])('%sカードに名称・カテゴリ・住所を表示する', (category, label) => {
    const onSelect = vi.fn();
    render(
      <RegionalSponsorCard
        sponsor={sponsor({ category })}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('テスト専用地域協賛')).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('テスト県テスト市1-2-3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /詳細を表示/ }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('未知カテゴリを除外せず中立色の未分類として表示する', () => {
    render(
      <RegionalSponsorCard
        sponsor={sponsor({ category: 'future-category' })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('未分類')).toBeInTheDocument();
  });
});

describe('RegionalSponsorList / RegionalSponsorDetail', () => {
  it('CMS順を維持して動的件数を表示し、0件案内も表示する', () => {
    const onScroll = vi.fn();
    const { rerender } = render(
      <RegionalSponsorList
        sponsors={[
          sponsor({ id: 2, name: '先' }),
          sponsor({ id: 1, name: '後' }),
        ]}
        selectedSponsorId={null}
        initialScrollTop={0}
        onScrollTopChange={onScroll}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('2件')).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual([expect.stringContaining('先'), expect.stringContaining('後')]);

    rerender(
      <RegionalSponsorList
        sponsors={[]}
        selectedSponsorId={null}
        initialScrollTop={0}
        onScrollTopChange={onScroll}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('0件')).toBeInTheDocument();
    expect(screen.getByText(/条件に一致/)).toBeInTheDocument();
  });

  it('詳細を所定順で表示し、病院用見出し・改行・安全な外部リンクを保つ', () => {
    render(
      <RegionalSponsorDetail
        sponsor={sponsor({ category: 'hospital' })}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(screen.getByText('診療時間・休診日')).toBeInTheDocument();
    expect(screen.getByText(/午前 9時〜12時/)).toHaveClass(
      'whitespace-pre-wrap',
    );
    expect(
      screen.getByRole('link', { name: /公式Webサイト（外部サイト）/ }),
    ).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('任意項目・空節・無効URLをDOMごと省略し、病院以外の見出しを使う', () => {
    render(
      <RegionalSponsorDetail
        sponsor={sponsor({
          message: null,
          address: null,
          businessHours: '10時から',
          closedDays: null,
          phone: null,
          websiteUrl: 'javascript:alert(1)',
        })}
        onBack={vi.fn()}
      />,
    );
    expect(screen.queryByText('メッセージ')).not.toBeInTheDocument();
    expect(screen.getByText('営業時間・定休日')).toBeInTheDocument();
    expect(screen.queryByText('住所')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('RegionalSponsorSearch', () => {
  it('検索と「すべて」を含む7操作を提供し、選択をaria-pressedで示す', () => {
    const onQueryChange = vi.fn();
    const onCategoryToggle = vi.fn();
    render(
      <RegionalSponsorSearch
        query=""
        selectedCategories={new Set(['hospital'])}
        onQueryChange={onQueryChange}
        onCategoryToggle={onCategoryToggle}
      />,
    );
    expect(
      screen.getByRole('searchbox', { name: /店舗名・カテゴリ・住所/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.getByRole('button', { name: /病院/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /病院/ })).not.toHaveTextContent(
      '✓',
    );
    expect(screen.getByRole('button', { name: /病院/ })).toHaveClass(
      'bg-primary',
    );
    expect(screen.getByRole('button', { name: /生活/ })).toHaveClass(
      'bg-white',
    );
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'テスト' },
    });
    fireEvent.click(screen.getByRole('button', { name: /すべて/ }));
    expect(onQueryChange).toHaveBeenCalledWith('テスト');
    expect(onCategoryToggle).toHaveBeenCalledWith('all');
  });
});
