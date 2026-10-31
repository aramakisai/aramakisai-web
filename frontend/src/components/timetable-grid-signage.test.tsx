import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimetableGrid } from './timetable-grid';
import type { TimetablePerformance } from '@/lib/timetable';

vi.mock('@/lib/cms', () => ({ cms: {} }));

const jst = (hhmm: string) =>
  new Date(`2026-11-14T${hhmm}:00+09:00`).toISOString();
const perf = (
  id: number,
  stageId: number,
  start: string,
  end: string,
  name: string,
  href: string | null = null,
): TimetablePerformance => ({
  id,
  stageId,
  name,
  projectName: null,
  href,
  slot: { dateKey: '2026-11-14', startAt: jst(start), endAt: jst(end) },
});

const stages = [
  { id: 1, name: 'メイン' },
  { id: 2, name: '中庭' },
  { id: 3, name: '講義棟' },
];
const performances = [
  perf(1, 1, '10:00', '10:20', '開会式'),
  perf(2, 1, '10:30', '11:00', '軽音楽部', '/exhibitions/5/stage'),
  perf(3, 2, '10:00', '10:10', '短い枠'),
  perf(4, 3, '11:00', '12:00', '出演中の枠', '/exhibitions/9/stage'),
];
const now = new Date(jst('11:30'));

const li = (name: string) => screen.getByText(name).closest('li')!;

describe('TimetableGrid signage', () => {
  it('1 分 6px で枠の位置と高さを決める (枠の上下は 2px の余白)', () => {
    render(
      <TimetableGrid
        stages={stages}
        performances={performances}
        now={now}
        variant="signage"
      />,
    );
    // 開会式 10:00-10:20、範囲の開始 10:00
    expect(li('開会式').style.top).toBe('0px');
    expect(li('開会式').style.height).toBe('120px');
    expect(li('軽音楽部').style.top).toBe('180px');
    expect(li('軽音楽部').style.height).toBe('180px');
  });

  it('時刻の列は 96、ステージ列は残りを等分する', () => {
    render(
      <TimetableGrid
        stages={stages}
        performances={performances}
        now={now}
        variant="signage"
      />,
    );
    const grid = screen.getByTestId('timetable-grid');
    expect(grid.firstElementChild).not.toHaveStyle({ minWidth: '1px' });
    const timeCol = grid.querySelector('[aria-hidden="true"].relative')!;
    expect((timeCol as HTMLElement).style.width).toBe('96px');
    expect(grid.querySelectorAll('section.flex-1')).toHaveLength(3);
  });

  it('site は従来の 1 分 4px のまま', () => {
    render(
      <TimetableGrid stages={stages} performances={performances} now={now} />,
    );
    expect(li('軽音楽部').style.top).toBe('120px');
  });

  it('出演中の枠は 1 行目に「出演中」と時刻を並べる', () => {
    render(
      <TimetableGrid
        stages={stages}
        performances={performances}
        now={now}
        variant="signage"
      />,
    );
    const card = li('出演中の枠');
    expect(card.textContent).toContain('出演中');
    expect(card.textContent).toContain('11:00〜12:00');
    expect(card.querySelector('[aria-current="true"]')).not.toBeNull();
  });

  it('15 分未満の枠は時刻と企画名を 1 行に並べる', () => {
    render(
      <TimetableGrid
        stages={stages}
        performances={performances}
        now={now}
        variant="signage"
      />,
    );
    const row = screen.getByText('短い枠').parentElement!;
    expect(row).toHaveClass('flex');
    expect(row.textContent).toContain('10:00〜10:10');
  });
});
