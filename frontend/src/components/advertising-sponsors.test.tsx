import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AdSponsor, AdSponsorsByTier } from '@/lib/advertising-sponsors';
import {
  AdvertisingSponsors,
  AdvertisingSponsorsContent,
} from './advertising-sponsors';
import tailwindConfig from '../../tailwind.config';

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

describe('AdvertisingSponsorsContent', () => {
  it('指定された本文の順序で全個人名を敬称付きで表示する', () => {
    const { container } = render(
      <AdvertisingSponsorsContent
        sponsors={groups}
        personalSponsors={[
          { id: 1, name: '田中' },
          { id: 2, name: '佐藤様' },
          { id: 3, name: '非常に長い協賛者の表示名'.repeat(5) },
        ]}
      />,
    );
    const title = screen.getByRole('heading', { level: 1, name: '広告協賛' });
    const companyThanks = screen.getByText(
      '荒牧祭2026の開催にあたり、ご協賛いただいた企業・団体の皆様に心より御礼申し上げます。',
    );
    const companyList = container.querySelector('[data-tier="planD"]')!;
    const divider = screen.getByRole('separator');
    const personalHeading = screen.getByRole('heading', {
      level: 2,
      name: '個人協賛者様',
    });
    const personalThanks = screen.getByText(
      '荒牧祭2026への温かいご支援に心より感謝申し上げます。',
    );
    const personalList = screen.getByRole('list', { name: '個人協賛者様' });
    const ordered = [
      title,
      companyThanks,
      companyList,
      divider,
      personalHeading,
      personalThanks,
      personalList,
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(
        ordered[i - 1].compareDocumentPosition(ordered[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    const items = within(personalList).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '田中様',
      '佐藤様',
      `${'非常に長い協賛者の表示名'.repeat(5)}様`,
    ]);
    expect(items[2]).toHaveClass('break-words', 'min-w-0');
    expect(personalList).toHaveClass(
      'grid-cols-2',
      'lg:grid-cols-3',
      'gap-x-4',
      'gap-y-3',
      'lg:gap-x-6',
      'lg:gap-y-4',
    );
    expect(screen.queryByText(/匿名|もっと見る/)).not.toBeInTheDocument();
  });

  it('データがない場合も架空の人名や空状態文言を追加しない', () => {
    render(
      <AdvertisingSponsorsContent
        sponsors={{ planA: [], planB: [], planC: [], planD: [] }}
        personalSponsors={[]}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: '広告協賛' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '個人協賛者様' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/匿名|登録されていません|もっと見る/),
    ).not.toBeInTheDocument();
  });
});

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

  it('URLがあるロゴカード全体とDの企業名を安全な新規タブリンクにする', () => {
    const linked: AdSponsorsByTier = {
      ...groups,
      planA: [
        { ...groups.planA[0], url: 'https://example.com/a' },
        groups.planA[1],
      ],
      planB: [{ ...groups.planB[0], url: 'http://example.com/b' }],
      planC: [{ ...groups.planC[0], url: 'https://example.com/c' }],
      planD: [
        { ...groups.planD[0], url: 'https://example.com/d' },
        groups.planD[1],
      ],
    };
    render(<AdvertisingSponsors sponsors={linked} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(within(link).getByText('新しいタブで開きます')).toHaveClass(
        'sr-only',
      );
      expect(link.querySelector('svg')).toBeNull();
      expect(link).toHaveClass(
        'focus-visible:outline-2',
        'focus-visible:outline-text',
      );
    }
    for (const [index, href] of [
      'https://example.com/a',
      'http://example.com/b',
      'https://example.com/c',
    ].entries()) {
      expect(links[index]).toHaveAttribute('href', href);
      expect(within(links[index]).getByRole('img')).toBeInTheDocument();
      expect(links[index]).toHaveClass('h-full', 'w-full');
      expect(links[index].parentElement).toHaveClass(
        'hover:border-[#d3d3d3]',
        'motion-reduce:transition-none',
      );
    }
    expect(links[3]).toHaveAttribute('href', 'https://example.com/d');
    expect(links[3]).toHaveClass('group/row');
    expect(links[3].querySelector('.mansai-spectrum-line')).toBeInTheDocument();
    const unlinkedLogo = screen.getByAltText('企業2').closest('li');
    expect(unlinkedLogo?.querySelector('a')).toBeNull();
    expect(unlinkedLogo).not.toHaveClass('hover:border-[#d3d3d3]');
    const unlinkedText = screen.getByText('企業6').closest('li');
    expect(unlinkedText?.querySelector('a')).toBeNull();
    expect(unlinkedText?.querySelector('.mansai-spectrum-line')).toBeNull();
  });

  it('フォーカス色は既存のtextトークンを使い、白背景と3:1以上のコントラストを保つ', () => {
    const colors = tailwindConfig.theme?.extend?.colors as Record<
      string,
      string
    >;
    const channels = colors.text.match(/[\da-f]{2}/gi)?.map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    expect(channels).toHaveLength(3);
    const luminance =
      0.2126 * channels![0] + 0.7152 * channels![1] + 0.0722 * channels![2];
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(3);
  });
});
