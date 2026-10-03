import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ParkingList } from './parking-list';
import type { ParkingResponse } from '@/lib/parking';

const RENDERED_AT = '2026-11-14T04:00:00Z'; // JST 13:00

const enabled = (
  lots: ParkingResponse['lots'],
  fetchedAt = '2026-11-14T03:59:00Z', // JST 12:59
): ParkingResponse => ({
  isEventDay: true,
  lots,
  fetchedAt,
});

const closed = (lots: ParkingResponse['lots']): ParkingResponse => ({
  isEventDay: false,
  lots: lots.map((l) => ({ ...l, status: null, updatedAt: null })),
  fetchedAt: '2026-11-14T03:59:00Z',
});

const LOT = {
  id: 1,
  name: '正門前駐車場',
  status: 'available' as const,
  updatedAt: '2026-11-14T03:50:00Z',
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ok = (body: ParkingResponse) => ({ ok: true, json: async () => body });
const tick = () => act(() => vi.advanceTimersByTimeAsync(20_000));

describe('ParkingList', () => {
  test('通常は見出し・取得時刻・一覧を出す', () => {
    render(<ParkingList initial={enabled([LOT])} renderedAt={RENDERED_AT} />);
    expect(
      screen.getByRole('heading', { level: 1, name: '駐車場空き情報' }),
    ).toBeInTheDocument();
    expect(screen.getByText('12:59時点')).toBeInTheDocument();
    expect(screen.getByText('正門前駐車場')).toBeInTheDocument();
  });

  test('20秒ごとに /api/parking を再取得して更新する', async () => {
    fetchMock.mockResolvedValue(
      ok(enabled([{ ...LOT, name: '北門駐車場' }], '2026-11-14T04:00:20Z')),
    );
    render(<ParkingList initial={enabled([LOT])} renderedAt={RENDERED_AT} />);
    await tick();
    expect(fetchMock).toHaveBeenCalledWith('/api/parking', expect.anything());
    expect(screen.getByText('北門駐車場')).toBeInTheDocument();
    expect(screen.getByText('13:00時点')).toBeInTheDocument();
  });

  test('取得失敗中は sync_problem と失敗文言に切り替え、一覧は残す', async () => {
    fetchMock.mockRejectedValue(new Error('x'));
    render(<ParkingList initial={enabled([LOT])} renderedAt={RENDERED_AT} />);
    await tick();
    expect(screen.getByText('sync_problem')).toHaveClass(
      'material-symbols-sharp',
    );
    expect(
      screen.getByText('最新の情報を取得できません(12:59時点)'),
    ).toBeInTheDocument();
    expect(screen.getByText('正門前駐車場')).toBeInTheDocument();
  });

  test('HTTP エラーも取得失敗として扱う', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<ParkingList initial={enabled([LOT])} renderedAt={RENDERED_AT} />);
    await tick();
    expect(screen.getByText('sync_problem')).toBeInTheDocument();
  });

  test('初回取得失敗で値が無いときは時刻なしの文言のみで一覧を出さない', () => {
    render(<ParkingList initial={null} renderedAt={RENDERED_AT} />);
    expect(screen.getByText('最新の情報を取得できません')).toBeInTheDocument();
    expect(screen.getByText('sync_problem')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  test('初回失敗後の取得成功で回復する', async () => {
    fetchMock.mockResolvedValue(ok(enabled([LOT])));
    render(<ParkingList initial={null} renderedAt={RENDERED_AT} />);
    await tick();
    expect(screen.getByText('正門前駐車場')).toBeInTheDocument();
    expect(screen.queryByText('sync_problem')).not.toBeInTheDocument();
  });

  test('0件は専用の文言を出す', () => {
    render(<ParkingList initial={enabled([])} renderedAt={RENDERED_AT} />);
    expect(screen.getByText('駐車場の情報はありません')).toBeInTheDocument();
    expect(screen.getByText('12:59時点')).toBeInTheDocument();
  });

  test('未設定の行はグレーの「未設定」バッジで更新時刻を出さない', () => {
    render(
      <ParkingList
        initial={enabled([{ ...LOT, status: null, updatedAt: null }])}
        renderedAt={RENDERED_AT}
      />,
    );
    expect(screen.getByText('未設定')).toBeInTheDocument();
    expect(screen.queryByText(/更新/)).not.toBeInTheDocument();
  });

  test('当日でないときは名称とグレーの「非公開」だけで、状態行も再取得も無い', async () => {
    render(<ParkingList initial={closed([LOT])} renderedAt={RENDERED_AT} />);
    expect(screen.getByText('正門前駐車場')).toBeInTheDocument();
    expect(screen.getByText('非公開')).toHaveClass('bg-gray-200');
    expect(screen.queryByText(/時点/)).not.toBeInTheDocument();
    expect(screen.queryByText(/更新/)).not.toBeInTheDocument();
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('再取得で当日でなくなったら非公開表示に切り替えてポーリングを止める', async () => {
    fetchMock.mockResolvedValue(ok(closed([LOT])));
    render(<ParkingList initial={enabled([LOT])} renderedAt={RENDERED_AT} />);
    await tick();
    expect(screen.getByText('非公開')).toBeInTheDocument();
    expect(screen.queryByText('空き')).not.toBeInTheDocument();
    expect(screen.queryByText(/時点/)).not.toBeInTheDocument();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('固定幅でスマホ幅からはみ出さない', () => {
    const { container } = render(
      <ParkingList initial={enabled([LOT])} renderedAt={RENDERED_AT} />,
    );
    expect(container.innerHTML).not.toMatch(/\bw-\[\d+px\]|\bmin-w-\[/);
  });
});
