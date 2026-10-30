import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExhibitionCard } from './exhibition-card';
import { ExhibitionMenu } from './exhibition-menu';
import { ExhibitionPerformances } from './exhibition-performances';
import { RichText } from './rich-text';
import { TimetableGrid } from './timetable-grid';
import { TopicCard } from './topic-card';
import { TopicsList } from './topics-list';
import { AreaExhibitionList } from './campus-map/area-exhibition-list';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';
import type { TimetablePerformance } from '@/lib/timetable';

vi.mock('@/lib/cms-asset-url', () => {
  const toAssetUrl = (id: string | null) =>
    id ? `https://example.com/${id}` : null;
  return {
    toAssetUrl,
    toCardImageUrl: (image: { id: string }) => toAssetUrl(image.id),
    toHeroImage: (image: { id: string }) => {
      const src = toAssetUrl(image.id);
      return src ? { src } : null;
    },
  };
});
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));
vi.mock('@/lib/cms', () => ({ cms: {} }));

const exhibition: ExhibitionCardSummary = {
  id: 1,
  category: 'exhibit',
  displayName: '手作り展',
  organizationName: '団体',
  location: 'Aゾーン',
  areaIds: [1],
  thumbnail: null,
};

describe('ExhibitionCard variant', () => {
  it('site は従来の文字', () => {
    render(<ExhibitionCard exhibition={exhibition} />);
    expect(screen.getByText('Aゾーン')).toHaveClass('text-xs');
    expect(screen.getByTestId('icon-place').style.fontSize).toBe('16px');
  });
  it('signage は場所が meta・企画名が heading・アイコン24', () => {
    render(<ExhibitionCard exhibition={exhibition} variant="signage" />);
    const loc = screen.getByText('Aゾーン').parentElement;
    expect(loc).toHaveClass('text-signage-meta', 'text-gray-600');
    expect(screen.getByTestId('icon-place').style.fontSize).toBe('24px');
    expect(screen.getByText('手作り展')).toHaveClass(
      'text-signage-heading',
      'leading-[35px]',
      'font-bold',
      'text-text',
    );
  });
});

describe('ExhibitionCard image fit', () => {
  it('signage でも site と同じ object-contain', () => {
    render(
      <ExhibitionCard
        exhibition={{ ...exhibition, thumbnail: { id: 1, alt: 'a' } } as never}
        variant="signage"
      />,
    );
    expect(screen.getByAltText('a')).toHaveClass('object-contain');
  });
});

describe('TopicCard / TopicsList variant', () => {
  it('signage のカードタイトルは heading', () => {
    render(<TopicCard id={1} title="題" imageId={null} variant="signage" />);
    expect(screen.getByText('題')).toHaveClass(
      'text-signage-heading',
      'leading-[35px]',
    );
  });
  it('site のカードタイトルは heading クラスを持たない', () => {
    render(<TopicCard id={1} title="題" imageId={null} />);
    expect(screen.getByText('題')).not.toHaveClass('text-signage-heading');
  });
  it('TopicsList は cardVariant をカードへ渡す', () => {
    render(
      <TopicsList
        topics={[{ id: 1, title: '題', imageId: null }]}
        cardVariant="signage"
      />,
    );
    expect(screen.getByText('題')).toHaveClass('text-signage-heading');
  });
});

describe('AreaExhibitionList variant', () => {
  const state = {
    kind: 'filtered' as const,
    areaName: '1号館',
    facilities: { hasAed: true, hasToilet: true },
    keyword: '',
    categories: [],
    items: [exhibition],
  };
  it('signage は見出し heading・件数 meta・設備アイコン24、カードも signage', () => {
    render(<AreaExhibitionList state={state} variant="signage" />);
    expect(screen.getByRole('heading', { name: '1号館' })).toHaveClass(
      'text-signage-heading',
    );
    expect(screen.getByText('1件')).toHaveClass(
      'text-signage-meta',
      'text-gray-600',
    );
    expect(screen.getByTestId('icon-ecg-heart').style.fontSize).toBe('24px');
    expect(screen.getByText('AED')).toBeInTheDocument();
    expect(screen.getByText('Aゾーン').parentElement).toHaveClass(
      'text-signage-meta',
    );
  });
  it('signage の見出しは base の h2 余白を打ち消し、件数は「N件」', () => {
    render(<AreaExhibitionList state={state} variant="signage" />);
    expect(screen.getByRole('heading', { name: '1号館' })).toHaveClass('py-0');
    expect(screen.getByText('1件')).toBeInTheDocument();
  });
  it('signage の未選択メッセージは py-0 と gray-600', () => {
    render(
      <AreaExhibitionList state={{ kind: 'unselected' }} variant="signage" />,
    );
    expect(
      screen.getByRole('heading', { name: 'エリアを選択してください' }),
    ).toHaveClass('py-0', 'text-gray-600', 'leading-[38px]');
  });
  it('site は従来', () => {
    render(<AreaExhibitionList state={state} />);
    expect(screen.getByRole('heading', { name: '1号館' })).toHaveClass(
      'text-2xl',
    );
    expect(screen.getByTestId('icon-ecg-heart').style.fontSize).toBe('14px');
  });
});

describe('TimetableGrid variant', () => {
  const jst = (hhmm: string) =>
    new Date(`2026-11-14T${hhmm}:00+09:00`).toISOString();
  const p = (
    id: number,
    s: string,
    e: string,
    name: string,
  ): TimetablePerformance => ({
    id,
    stageId: 1,
    name,
    href: '/exhibitions/1/stage',
    slot: { dateKey: '2026-11-14', startAt: jst(s), endAt: jst(e) },
  });
  const props = {
    stages: [{ id: 1, name: 'メイン' }],
    performances: [
      p(1, '10:00', '10:30', '軽音'),
      p(2, '11:00', '11:40', '演奏'),
    ],
    now: new Date(jst('11:10')),
  };
  it('site は従来の文字', () => {
    render(<TimetableGrid {...props} />);
    expect(screen.getByText('軽音')).toHaveClass('text-sm');
    expect(screen.getByRole('heading', { name: 'メイン' })).toHaveClass(
      'text-sm',
    );
  });
  it('signage は企画名・ステージ名 heading、時刻 meta、出演中 label、アイコン寸法', () => {
    render(<TimetableGrid {...props} variant="signage" />);
    expect(screen.getByText('軽音')).toHaveClass('text-signage-heading');
    expect(screen.getByRole('heading', { name: 'メイン' })).toHaveClass(
      'text-signage-heading',
    );
    expect(screen.getByText('10:00〜10:30')).toHaveClass(
      'text-signage-meta',
      'text-gray-600',
    );
    expect(screen.getByText('出演中')).toHaveClass('text-signage-label');
    expect(screen.getByTestId('icon-play-circle').style.fontSize).toBe('24px');
    expect(screen.getAllByTestId('icon-chevron-right')[0].style.fontSize).toBe(
      '28px',
    );
  });
});

describe('詳細本文の部品 variant', () => {
  it('ExhibitionMenu signage は meta', () => {
    render(
      <ExhibitionMenu
        items={[{ name: 'たこ焼き', price: 500 }]}
        variant="signage"
      />,
    );
    expect(screen.getByText('メニュー')).toHaveClass('text-signage-meta');
    expect(screen.getByRole('table')).toHaveClass('text-signage-meta');
  });
  it('ExhibitionMenu site は従来', () => {
    render(<ExhibitionMenu items={[{ name: 'たこ焼き', price: 500 }]} />);
    expect(screen.getByRole('table')).toHaveClass('text-sm');
  });
  it('ExhibitionPerformances signage はアイコン24・文字 meta', () => {
    const perf = {
      stageName: 'メイン',
      dayLabel: '11/14',
      startAt: '2026-11-14T01:00:00Z',
      endAt: '2026-11-14T02:00:00Z',
    };
    const { container } = render(
      <ExhibitionPerformances performances={[perf]} variant="signage" />,
    );
    expect(screen.getByTestId('icon-schedule').style.fontSize).toBe('24px');
    expect(container.firstElementChild).toHaveClass('text-signage-meta');
  });
  it('RichText signage は body', () => {
    const { container } = render(
      <RichText html="<p>本文</p>" variant="signage" />,
    );
    expect(container.firstElementChild).toHaveClass('text-signage-body');
  });
  it('RichText site は body クラスを持たない', () => {
    const { container } = render(<RichText html="<p>本文</p>" />);
    expect(container.firstElementChild).not.toHaveClass('text-signage-body');
  });
});
