import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ExhibitionPerformances } from './exhibition-performances';
import type { ExhibitionPerformance } from '@/lib/timetable';

function jst(dateKey: string, hhmm: string): string {
  return new Date(`${dateKey}T${hhmm}:00+09:00`).toISOString();
}

const performances: ExhibitionPerformance[] = [
  {
    stageName: 'メインステージ',
    dayLabel: '11/14 土',
    startAt: jst('2026-11-14', '10:30'),
    endAt: jst('2026-11-14', '11:00'),
  },
  {
    stageName: '中庭ステージ',
    dayLabel: '11/15 日',
    startAt: jst('2026-11-15', '13:00'),
    endAt: jst('2026-11-15', '13:45'),
  },
];

describe('ExhibitionPerformances', () => {
  test('見出しと、開催日・時間・ステージ名の行を並び順どおりに出す', () => {
    render(<ExhibitionPerformances performances={performances} />);
    expect(
      screen.getByRole('heading', { level: 2, name: '出演時間' }),
    ).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
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
    expect(links[0]).toHaveAttribute('href', '/timetable');
    expect(within(links[0]).getByText('タイムテーブルを見る')).toBeTruthy();
  });

  test('0件なら何も描画しない', () => {
    const { container } = render(<ExhibitionPerformances performances={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
