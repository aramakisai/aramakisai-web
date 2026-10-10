import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { Timetable } from '@/lib/timetable';
// lib/timetable が cms クライアント経由で env を読み込むため
vi.mock('@/lib/cms', () => ({ cms: {} }));

import { TimetableSlide } from './timetable-slide';

const slot = (s: string, e: string) => ({
  dateKey: '2026-11-14',
  startAt: `2026-11-14T${s}:00+09:00`,
  endAt: `2026-11-14T${e}:00+09:00`,
});
const timetable: Timetable = {
  days: [{ key: '2026-11-14', label: '11/14' }],
  stages: [
    { id: 1, name: 'メインステージ' },
    { id: 2, name: '中庭ステージ' },
  ],
  performances: [
    {
      id: 1,
      stageId: 1,
      slot: slot('13:40', '14:30'),
      name: 'ダンス',
      href: '/x',
    },
    {
      id: 2,
      stageId: 2,
      slot: slot('12:30', '13:00'),
      name: '軽音',
      href: null,
    },
  ],
};

test('現在時刻から4時間窓を引き、出演中だけ区別し、リンクの印を出さない', () => {
  const { container } = render(
    <TimetableSlide
      timetable={timetable}
      now={new Date('2026-11-14T14:17:00+09:00')}
    />,
  );
  expect(screen.getByText('12:00')).toBeInTheDocument();
  expect(screen.getByText('16:00')).toBeInTheDocument();
  expect(screen.getAllByText('出演中')).toHaveLength(1);
  expect(screen.getByText('ダンス').parentElement).toHaveAttribute(
    'aria-current',
    'true',
  );
  expect(screen.getByText('軽音').parentElement).not.toHaveAttribute(
    'aria-current',
  );
  expect(container.querySelector('a')).toBeNull();
  const line = screen.getByTestId('timetable-now');
  expect(line.style.top).toBe(`${56 + 137 * 2.8 - 1}px`);
});

test('現在時刻が窓の外の日は線を出さない', () => {
  render(
    <TimetableSlide
      timetable={timetable}
      now={new Date('2026-11-13T14:17:00+09:00')}
    />,
  );
  expect(screen.queryByTestId('timetable-now')).toBeNull();
});
