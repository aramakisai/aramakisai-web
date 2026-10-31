import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TouchTimetable } from './touch-timetable';
import type { Timetable, TimetablePerformance } from '@/lib/timetable';

vi.mock('@/lib/cms', () => ({ cms: {} }));

const jst = (dateKey: string, hhmm: string) =>
  new Date(`${dateKey}T${hhmm}:00+09:00`).toISOString();

function perf(
  id: number,
  dateKey: string,
  start: string,
  end: string,
  name: string,
): TimetablePerformance {
  return {
    id,
    stageId: 1,
    name,
    projectName: null,
    href: null,
    slot: { dateKey, startAt: jst(dateKey, start), endAt: jst(dateKey, end) },
  };
}

const timetable: Timetable = {
  days: [
    { key: '2026-11-14', label: '1日目' },
    { key: '2026-11-15', label: '2日目' },
  ],
  stages: [{ id: 1, name: 'メインステージ' }],
  performances: [
    perf(1, '2026-11-14', '10:00', '10:20', '開会式'),
    perf(2, '2026-11-15', '13:00', '14:00', '二日目ライブ'),
  ],
};
const renderedAt = jst('2026-11-14', '09:00');

describe('TouchTimetable', () => {
  it('日付のボタンだけを操作に出し、ステージ切替は出さない', () => {
    render(
      <TouchTimetable
        timetable={timetable}
        initialDayKey="2026-11-14"
        renderedAt={renderedAt}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '11/14 土',
      '11/15 日',
    ]);
    expect(screen.getByText('開会式')).toBeInTheDocument();
  });

  it('日付を切り替えると表が切り替わる', () => {
    render(
      <TouchTimetable
        timetable={timetable}
        initialDayKey="2026-11-14"
        renderedAt={renderedAt}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '11/15 日' }));
    expect(screen.getByText('二日目ライブ')).toBeInTheDocument();
    expect(screen.queryByText('開会式')).toBeNull();
  });

  it('スクロール内容の下端に余白 240 を置く', () => {
    const { container } = render(
      <TouchTimetable
        timetable={timetable}
        initialDayKey="2026-11-14"
        renderedAt={renderedAt}
      />,
    );
    expect(container.firstElementChild).toHaveClass('pb-[240px]');
  });

  it('出演の無い日は「出演予定はありません」を出す', () => {
    render(
      <TouchTimetable
        timetable={{ ...timetable, performances: [] }}
        initialDayKey="2026-11-14"
        renderedAt={renderedAt}
      />,
    );
    expect(screen.getByText('出演予定はありません')).toBeInTheDocument();
  });
});
