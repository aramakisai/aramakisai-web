import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TimetablePage, { generateMetadata } from './page';
import * as timetableModule from '@/lib/timetable';
import type { Timetable } from '@/lib/timetable';

vi.mock('@/lib/timetable', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/timetable')>('@/lib/timetable');
  return { ...actual, getTimetable: vi.fn() };
});

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(async () => ({
    siteTitle: '荒牧祭',
    description: '荒牧祭公式サイト',
    ogImageUrl: null,
    festival: null,
  })),
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com' },
}));

const TIMETABLE: Timetable = {
  days: [
    { key: '2026-10-24', label: '1日目' },
    { key: '2026-10-25', label: '2日目' },
  ],
  stages: [{ id: 1, name: 'メインステージ' }],
  performances: [],
};

describe('TimetablePage', () => {
  it('見出しと開催日切替を表示し、リクエスト時刻から初期開催日を決める', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T03:00:00Z'));
    vi.mocked(timetableModule.getTimetable).mockResolvedValue(TIMETABLE);

    render(await TimetablePage());
    vi.useRealTimers();

    expect(
      screen.getByRole('heading', { name: 'タイムテーブル', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2日目/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('取得失敗は例外のまま伝える', async () => {
    vi.mocked(timetableModule.getTimetable).mockRejectedValue(new Error('x'));

    await expect(TimetablePage()).rejects.toThrow('x');
  });

  it('メタデータにタイトルと canonical を設定する', async () => {
    const meta = await generateMetadata();

    expect(meta.title).toBe('タイムテーブル');
    expect(meta.alternates?.canonical).toContain('/timetable');
  });
});
