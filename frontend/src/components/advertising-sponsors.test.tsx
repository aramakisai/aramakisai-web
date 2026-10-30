import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AdSponsor, AdSponsorsByTier } from '@/lib/advertising-sponsors';
import { AdvertisingSponsors } from './advertising-sponsors';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null, width?: number) =>
    id ? `/assets/${id}?width=${width}` : null,
}));

const sponsor = (id: number, tier: AdSponsor['tier']): AdSponsor => ({
  id,
  name: `企業${id}`,
  tier,
  logoId: tier === 'planD' ? null : `logo-${id}`,
  url: null,
});

const groups: AdSponsorsByTier = {
  planA: [sponsor(1, 'planA'), sponsor(2, 'planA')],
  planB: [sponsor(3, 'planB')],
  planC: [sponsor(4, 'planC')],
  planD: [sponsor(5, 'planD'), sponsor(6, 'planD')],
};

describe('AdvertisingSponsors', () => {
  it('AからDの順と各配列の順を保ち、ロゴまたは企業名だけを表示する', () => {
    const { container } = render(<AdvertisingSponsors sponsors={groups} />);
    const lists = screen.getAllByRole('list');
    expect(lists).toHaveLength(4);
    expect(lists.map((list) => list.getAttribute('data-tier'))).toEqual([
      'planA',
      'planB',
      'planC',
      'planD',
    ]);
    expect(
      within(lists[0])
        .getAllByRole('img')
        .map((img) => img.getAttribute('alt')),
    ).toEqual(['企業1', '企業2']);
    expect(within(lists[1]).getByRole('img')).toHaveAttribute('alt', '企業3');
    expect(within(lists[2]).getByRole('img')).toHaveAttribute('alt', '企業4');
    expect(
      within(lists[3])
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['企業5', '企業6']);
    expect(within(lists[3]).queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByAltText('企業1')).toHaveAttribute(
      'src',
      '/assets/logo-1?width=960',
    );
    expect(container.querySelector('h1, h2, h3, h4, hr')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('プランごとの列・カード比・ロゴ領域・間隔を設定する', () => {
    render(<AdvertisingSponsors sponsors={groups} />);
    const [a, b, c, d] = screen.getAllByRole('list');
    expect(a).toHaveClass('grid-cols-1', 'lg:grid-cols-2', 'gap-3', 'lg:gap-6');
    expect(b).toHaveClass('grid-cols-2', 'lg:grid-cols-3', 'gap-3', 'lg:gap-6');
    expect(c).toHaveClass('grid-cols-2', 'lg:grid-cols-4', 'gap-3', 'lg:gap-4');
    expect(d).toHaveClass(
      'grid-cols-2',
      'lg:grid-cols-3',
      'gap-x-4',
      'gap-y-3',
      'lg:gap-x-6',
      'lg:gap-y-4',
    );
    expect(within(a).getAllByRole('listitem')[0]).toHaveClass('aspect-[7/3]');
    expect(within(b).getByRole('listitem')).toHaveClass('aspect-[2/1]');
    expect(within(c).getByRole('listitem')).toHaveClass('aspect-[2/1]');
    expect(screen.getByAltText('企業1')).toHaveClass('object-contain');
    expect(screen.getByAltText('企業1').parentElement).toHaveClass(
      'w-[calc(100%*300/358)]',
      'lg:w-[calc(100%*460/548)]',
    );
    expect(screen.getByAltText('企業3').parentElement).toHaveClass(
      'w-[calc(100%*145/173)]',
      'lg:w-[calc(100%*300/357)]',
    );
    expect(screen.getByAltText('企業4').parentElement).toHaveClass(
      'w-[calc(100%*135/173)]',
      'lg:w-[calc(100%*220/268)]',
    );
    expect(screen.getByAltText('企業1').parentElement).toHaveClass(
      'aspect-[300/110]',
      'lg:aspect-[460/170]',
    );
    expect(screen.getByAltText('企業3').parentElement).toHaveClass(
      'aspect-[145/60]',
      'lg:aspect-[300/120]',
    );
    expect(screen.getByAltText('企業4').parentElement).toHaveClass(
      'aspect-[135/54]',
      'lg:aspect-[220/86]',
    );
    expect(within(d).getAllByRole('listitem')[0]).toHaveClass('break-words');
  });

  it('空のプランに空カードや架空のデータを追加しない', () => {
    render(
      <AdvertisingSponsors
        sponsors={{ planA: [], planB: [], planC: [], planD: [] }}
      />,
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
