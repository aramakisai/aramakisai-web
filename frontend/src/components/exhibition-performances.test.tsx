import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ExhibitionPerformances } from './exhibition-performances';
import type { ExhibitionPerformance } from '@/lib/timetable';

function jst(dateKey: string, hhmm: string): string {
  return new Date(`${dateKey}T${hhmm}:00+09:00`).toISOString();
}

const performances: ExhibitionPerformance[] = [
  {
    id: 11,
    dateKey: '2026-11-14',
    stageId: 1,
    stageName: 'メインステージ',
    dayLabel: '11/14 土',
    startAt: jst('2026-11-14', '10:30'),
    endAt: jst('2026-11-14', '11:00'),
  },
  {
    id: 12,
    dateKey: '2026-11-15',
    stageId: 2,
    stageName: '中庭ステージ',
    dayLabel: '11/15 日',
    startAt: jst('2026-11-15', '13:00'),
    endAt: jst('2026-11-15', '13:45'),
  },
];

// lib/timetable が cms クライアント経由で env を読み込むため
vi.mock('@/lib/cms', () => ({ cms: {} }));

describe('ExhibitionPerformances', () => {
  afterEach(() => vi.useRealTimers());

  test('見出し無しで、開催日・時間・ステージ名の行を並び順どおりに出す', () => {
    render(<ExhibitionPerformances performances={performances} />);
    expect(screen.queryByRole('heading')).toBeNull();
    const rows = [screen.getByText(/11\/14 土/), screen.getByText(/11\/15 日/)];
    expect(rows[0]).toHaveTextContent('11/14 土');
    expect(rows[0]).toHaveTextContent('10:30〜11:00');
    expect(rows[0]).toHaveTextContent('メインステージ');
    expect(rows[1]).toHaveTextContent('11/15 日');
    expect(rows[1]).toHaveTextContent('13:00〜13:45');
    expect(rows[1]).toHaveTextContent('中庭ステージ');
  });

  test('タイムテーブルへのリンクは1本だけ', () => {
    render(<ExhibitionPerformances performances={performances} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(within(links[0]).getByText('タイムテーブルを見る')).toBeTruthy();
  });

  test('今日の回が無ければ最初の回へのリンク', () => {
    vi.useFakeTimers({ now: new Date(jst('2026-11-13', '12:00')) });
    render(<ExhibitionPerformances performances={performances} />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/timetable?day=2026-11-14&stage=1&performance=11',
    );
  });

  test('マウント後に今日の回へ切り替わる', () => {
    vi.useFakeTimers({ now: new Date(jst('2026-11-15', '12:00')) });
    render(<ExhibitionPerformances performances={performances} />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/timetable?day=2026-11-15&stage=2&performance=12',
    );
  });

  test('signage は /timetable のまま', () => {
    render(
      <ExhibitionPerformances performances={performances} variant="signage" />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/timetable');
  });

  test('0件なら何も描画しない', () => {
    const { container } = render(<ExhibitionPerformances performances={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
