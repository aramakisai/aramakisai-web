import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ParkingList } from './parking-list';
import type { ParkingResponse } from '@/lib/parking';

const RENDERED_AT = '2026-11-14T04:00:00Z'; // JST 13:00

const enabled = (
  lots: { id: number; name: string; status: 'available'; updatedAt: string }[],
  fetchedAt = '2026-11-14T03:59:00Z', // JST 12:59
): ParkingResponse => ({
  enabled: true,
  lots,
  fetchedAt,
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

  test('非公開は文言だけを出し、状態行・一覧・再取得はしない', async () => {
    render(
      <ParkingList initial={{ enabled: false }} renderedAt={RENDERED_AT} />,
    );
    expect(
      screen.getByText('現在、駐車場空き情報は公開していません'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('再取得で非公開になったら表示を切り替えてポーリングを止める', async () => {
    fetchMock.mockResolvedValue(ok({ enabled: false }));
    render(<ParkingList initial={enabled([LOT])} renderedAt={RENDERED_AT} />);
    await tick();
    expect(
      screen.getByText('現在、駐車場空き情報は公開していません'),
    ).toBeInTheDocument();
    expect(screen.queryByText('正門前駐車場')).not.toBeInTheDocument();
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
