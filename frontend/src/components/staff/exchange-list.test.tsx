import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExchangeList, formatJst } from './exchange-list';

const row = (over: object = {}) => ({
  exchangeId: 1,
  visitorId: '3f2a9c1e-1111-4111-8111-111111111111',
  exchangedAt: '2026-11-14T04:42:00.000Z',
  exchangedBy: 'taro@example.invalid',
  cancelledAt: null,
  cancelledBy: null,
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe('formatJst', () => {
  it('JST の月/日 時:分にする', () => {
    expect(formatJst('2026-11-14T04:42:00.000Z')).toBe('11/14 13:42');
    expect(formatJst('2026-11-14T16:05:00.000Z')).toBe('11/15 01:05');
  });
});

describe('ExchangeList', () => {
  it('匿名IDの先頭 8 文字・日時・担当を出し、取り消し済みの行には取り消しを置かない', () => {
    render(
      <ExchangeList
        initial={[
          row(),
          row({
            exchangeId: 2,
            exchangedAt: '2026-11-14T04:20:00.000Z',
            visitorId: 'c91e02aa-1111-4111-8111-111111111111',
            cancelledAt: '2026-11-14T04:28:00.000Z',
            cancelledBy: 'hanako@example.invalid',
          }),
        ]}
      />,
    );
    expect(screen.getByText('3f2a9c1e')).toBeTruthy();
    expect(screen.getByText('11/14 13:42 taro@example.invalid')).toBeTruthy();
    expect(
      screen.getByText('取り消し済み 11/14 13:28 hanako@example.invalid'),
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '取り消す' })).toHaveLength(1);
  });

  it('取り消すと API の応答で行を取り消し済みに更新する', async () => {
    const cancelled = row({
      cancelledAt: '2026-11-14T05:00:00.000Z',
      cancelledBy: 'hanako@example.invalid',
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ kind: 'cancelled', exchange: cancelled }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ExchangeList initial={[row()]} />);
    fireEvent.click(screen.getByRole('button', { name: '取り消す' }));
    await waitFor(() =>
      expect(
        screen.getByText('取り消し済み 11/14 14:00 hanako@example.invalid'),
      ).toBeTruthy(),
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/staff/exchanges/1/cancel', {
      method: 'POST',
    });
    expect(screen.queryByRole('button', { name: '取り消す' })).toBeNull();
  });

  it('取り消しに失敗したら行を変えずに通知する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 503 })),
    );
    render(<ExchangeList initial={[row()]} />);
    fireEvent.click(screen.getByRole('button', { name: '取り消す' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        '取り消せませんでした',
      ),
    );
    expect(screen.getByRole('button', { name: '取り消す' })).toBeTruthy();
  });
});
