import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TimetableView } from './timetable-view';
import type { Timetable, TimetablePerformance } from '@/lib/timetable';

// isPerformanceActive を持つ lib/timetable が cms クライアント経由で env を読み込むため
vi.mock('@/lib/cms', () => ({ cms: {} }));

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

describe('現在出演中の強調と現在時刻の線', () => {
  afterEach(() => vi.useRealTimers());

  function renderAt(hhmm: string, dayKey = '2026-11-14') {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(jst('2026-11-14', hhmm)));
    return render(
      <TimetableView
        timetable={timetable}
        initialDayKey={dayKey}
        renderedAt={jst('2026-11-14', hhmm)}
      />,
    );
  }

  test('出演中の枠に「出演中」と現在位置の属性が付き、他は付かない', () => {
    renderAt('10:05');
    const current = within(pc()).getByText('開会式').closest('li')!;
    expect(current).toHaveTextContent('出演中');
    expect(current.querySelector('[aria-current="true"]')).not.toBeNull();
    expect(
      within(pc()).getByText('軽音楽部').closest('li'),
    ).not.toHaveTextContent('出演中');
    const row = within(sp()).getByText('開会式').closest('li')!;
    expect(row).toHaveTextContent('出演中');
    expect(row.querySelector('[aria-current="true"]')).not.toBeNull();
  });

  test('現在時刻の線は選択日が今日で範囲内のときだけ出る', () => {
    const { unmount } = renderAt('10:05');
    const line = screen.getByTestId('timetable-now');
    expect(line).toHaveAttribute('aria-hidden', 'true');
    expect(line).toHaveTextContent('10:05');
    // 範囲 10:00 開始、48px の見出し + 5分×4px - 線の中心 10.5px
    expect(line.style.top).toBe('57.5px');
    unmount();
    renderAt('10:05', '2026-11-15');
    expect(screen.queryByTestId('timetable-now')).toBeNull();
    expect(screen.queryByText('出演中')).toBeNull();
  });

  test('範囲外の時刻では線を出さない', () => {
    renderAt('09:00');
    expect(screen.queryByTestId('timetable-now')).toBeNull();
  });

  test('時刻を進めると強調が次の枠へ移る', () => {
    renderAt('10:05');
    expect(within(sp()).getByText('開会式').closest('li')).toHaveTextContent(
      '出演中',
    );
    act(() => {
      vi.setSystemTime(new Date(jst('2026-11-14', '10:35')));
      vi.advanceTimersByTime(30_000);
    });
    expect(
      within(sp()).getByText('開会式').closest('li'),
    ).not.toHaveTextContent('出演中');
    expect(within(sp()).getByText('軽音楽部').closest('li')).toHaveTextContent(
      '出演中',
    );
  });
});

describe('TimetableView の初期開催日 (ISR のキャッシュ描画対策)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('マウント後は端末の現在日で開催日を選び直す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(jst('2026-11-15', '09:00')));

    // サーバー描画 (キャッシュ) 時点では 1 日目が選ばれていた
    renderView(timetable, '2026-11-14');

    expect(screen.getByRole('button', { name: /11\/15/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
