import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExchangeRecord } from '@/lib/stamp-db';
import { ExchangeActions } from './exchange-actions';

const ID = '3f2a9c1e-1111-4111-8111-111111111111';
const exchange: ExchangeRecord = {
  exchangeId: 5,
  visitorId: ID,
  exchangedAt: '2026-11-14T04:42:00.000Z',
  exchangedBy: 'taro@example.invalid',
  cancelledAt: null,
  cancelledBy: null,
};

const reply = (status: number, body: unknown) =>
  vi
    .fn()
    .mockResolvedValue({ ok: status < 400, status, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe('ExchangeActions', () => {
  it('登録の応答で表示を更新する', async () => {
    const fetchMock = reply(200, { kind: 'registered', exchange });
    vi.stubGlobal('fetch', fetchMock);
    render(<ExchangeActions visitorId={ID} initialExchange={null} eligible />);
    expect(screen.getByText('未交換')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '交換済みにする' }));
    await waitFor(() =>
      expect(screen.getByText('交換済み 11/14 13:42')).toBeTruthy(),
    );
    expect(screen.getByText('担当 taro@example.invalid')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/staff/exchanges',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ visitorId: ID }),
      }),
    );
  });

  it('登録が条件未達 (409) なら案内に切り替える', async () => {
    vi.stubGlobal('fetch', reply(409, { kind: 'not_eligible' }));
    render(<ExchangeActions visitorId={ID} initialExchange={null} eligible />);
    fireEvent.click(screen.getByRole('button', { name: '交換済みにする' }));
    await waitFor(() =>
      expect(
        screen.getByText('すべての企画のスタンプがそろっていません'),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('取り消しの応答で未交換に戻る', async () => {
    vi.stubGlobal(
      'fetch',
      reply(200, {
        kind: 'cancelled',
        exchange: { ...exchange, cancelledAt: '2026-11-14T05:00:00.000Z' },
      }),
    );
    render(
      <ExchangeActions visitorId={ID} initialExchange={exchange} eligible />,
    );
    fireEvent.click(screen.getByRole('button', { name: '取り消す' }));
    await waitFor(() => expect(screen.getByText('未交換')).toBeTruthy());
    expect(screen.getByRole('button', { name: '交換済みにする' })).toBeTruthy();
  });

  it('既に取り消されていた場合は取り消し日時を示して未交換に戻る', async () => {
    vi.stubGlobal(
      'fetch',
      reply(200, {
        kind: 'already',
        exchange: {
          ...exchange,
          cancelledAt: '2026-11-14T05:00:00.000Z',
          cancelledBy: 'jiro@example.invalid',
        },
      }),
    );
    render(
      <ExchangeActions visitorId={ID} initialExchange={exchange} eligible />,
    );
    fireEvent.click(screen.getByRole('button', { name: '取り消す' }));
    await waitFor(() =>
      expect(screen.getByText('既に取り消されています 11/14 14:00')).toBeTruthy(),
    );
    expect(screen.getByText('未交換')).toBeTruthy();
  });

  it('失敗したら表示を変えず案内を出す', async () => {
    vi.stubGlobal('fetch', reply(503, { error: 'unavailable' }));
    render(<ExchangeActions visitorId={ID} initialExchange={null} eligible />);
    fireEvent.click(screen.getByRole('button', { name: '交換済みにする' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('未交換')).toBeTruthy();
  });
});
