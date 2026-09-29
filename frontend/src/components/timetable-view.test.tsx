import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { TimetableView } from './timetable-view';
import type { Timetable, TimetablePerformance } from '@/lib/timetable';

function perf(
  id: number,
  stageId: number,
  dateKey: string,
  start: string,
  end: string,
  name: string,
  href: string | null = null,
): TimetablePerformance {
  return {
    id,
    stageId,
    name,
    href,
    slot: {
      dateKey,
      // JST の時刻を UTC に直した ISO (JST = UTC+9)
      startAt: jst(dateKey, start),
      endAt: jst(dateKey, end),
    },
  };
}

function jst(dateKey: string, hhmm: string): string {
  return new Date(`${dateKey}T${hhmm}:00+09:00`).toISOString();
}

const timetable: Timetable = {
  days: [
    { key: '2026-11-14', label: '11/14 土' },
    { key: '2026-11-15', label: '11/15 日' },
  ],
  stages: [
    { id: 1, name: 'メインステージ' },
    { id: 2, name: '中庭ステージ' },
  ],
  performances: [
    perf(1, 1, '2026-11-14', '10:00', '10:20', '開会式'),
    perf(
      2,
      1,
      '2026-11-14',
      '10:30',
      '11:00',
      '軽音楽部',
      '/exhibitions/5/stage',
    ),
    perf(3, 2, '2026-11-14', '10:10', '10:20', '中庭ライブ'),
    perf(4, 1, '2026-11-15', '13:00', '14:00', '二日目ライブ'),
  ],
};

const renderedAt = jst('2026-11-14', '09:00');

function renderView(
  t: Timetable = timetable,
  initialDayKey: string | null = '2026-11-14',
) {
  return render(
    <TimetableView
      timetable={t}
      initialDayKey={initialDayKey}
      renderedAt={renderedAt}
    />,
  );
}

const pc = () => screen.getByTestId('timetable-grid');
const sp = () => screen.getByTestId('timetable-list');

describe('TimetableView', () => {
  test('開催日のチップを開催日順に並べ、初期日が押下状態になる', () => {
    renderView();
    const chips = within(
      screen.getByRole('group', { name: '開催日' }),
    ).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['11/14 土', '11/15 日']);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    expect(chips[1]).toHaveAttribute('aria-pressed', 'false');
  });

  test('開催日を切り替えると表示が替わりステージ選択が保たれる', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: '中庭ステージ' }));
    expect(within(sp()).getByText('中庭ライブ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '11/15 日' }));
    expect(
      screen.getByRole('button', { name: '中庭ステージ' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(within(sp()).queryByText('中庭ライブ')).not.toBeInTheDocument();
    expect(within(sp()).getByText('出演予定はありません')).toBeInTheDocument();
    expect(within(pc()).getByText('二日目ライブ')).toBeInTheDocument();
    expect(within(pc()).queryByText('開会式')).not.toBeInTheDocument();
  });

  test('SPは選択ステージの出演枠を時刻列と名前で並べ、リンクの有無に従う', () => {
    renderView();
    const items = within(sp()).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining('開会式'),
      expect.stringContaining('軽音楽部'),
    ]);
    expect(items[0]).toHaveTextContent('10:00');
    expect(items[0]).toHaveTextContent('〜10:20');
    const links = within(sp()).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/exhibitions/5/stage');
    expect(
      within(links[0]).getByTestId('icon-chevron-right'),
    ).toBeInTheDocument();
    expect(within(items[0]).queryByTestId('icon-chevron-right')).toBeNull();
  });

  test('開催日程が無ければ切替を出さず空表示を1つだけ出す', () => {
    renderView({ ...timetable, days: [], performances: [] }, null);
    expect(screen.queryByRole('group', { name: '開催日' })).toBeNull();
    expect(screen.getAllByText('出演予定はありません')).toHaveLength(1);
  });

  test('選択日に出演枠が無ければPCはグリッドの代わりに空表示', () => {
    renderView({
      ...timetable,
      performances: timetable.performances.filter((p) => p.id === 4),
    });
    expect(screen.queryByTestId('timetable-grid')).toBeNull();
    expect(screen.getAllByText('出演予定はありません').length).toBeGreaterThan(
      0,
    );
  });
});

describe('TimetableGrid (PC)', () => {
  test('列がステージの表示順に並び、空欄には何も描かれない', () => {
    renderView();
    const cols = within(pc()).getAllByRole('region');
    expect(cols.map((c) => within(c).getByRole('heading').textContent)).toEqual(
      ['メインステージ', '中庭ステージ'],
    );
    expect(within(cols[1]).getAllByRole('listitem')).toHaveLength(1);
  });

  test('出演枠の上端・高さが表示範囲の開始からの分×4pxになる', () => {
    renderView();
    // 範囲は 10:00〜11:00。軽音楽部は 10:30〜11:00
    const item = within(pc()).getByText('軽音楽部').closest('li')!;
    expect(item.style.top).toBe('120px');
    expect(item.style.height).toBe('120px');
    const first = within(pc()).getByText('開会式').closest('li')!;
    expect(first.style.top).toBe('0px');
    expect(first.style.height).toBe('80px');
  });

  test('目盛りは支援技術から隠れる', () => {
    renderView();
    expect(pc().querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(
      screen.getAllByText('10:30', { selector: '[aria-hidden="true"] *' })
        .length,
    ).toBeGreaterThan(0);
  });

  test('リンクの枠は全体がリンクでchevronを持つ', () => {
    renderView();
    const link = within(pc()).getByRole('link');
    expect(link).toHaveAttribute('href', '/exhibitions/5/stage');
    expect(link).toHaveTextContent('10:30〜11:00');
    expect(within(link).getByTestId('icon-chevron-right')).toBeInTheDocument();
  });
});
