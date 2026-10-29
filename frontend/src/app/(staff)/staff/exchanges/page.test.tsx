import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  listExchanges: vi.fn(),
}));
vi.mock('@/lib/staff-page', () => ({ authorizeStaffPage: mocks.authorize }));
vi.mock('@/lib/stamp-db', () => ({
  createStampRepository: () => ({ listExchanges: mocks.listExchanges }),
}));
vi.mock('@/lib/stamp-metrics', () => ({ recordRequest: vi.fn() }));

import StaffExchangesPage from './page';

const usage = { rowsRead: 1, rowsWritten: 0, durationMs: 1 };

describe('StaffExchangesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({
      kind: 'allowed',
      env: {},
      staff: 'preview',
    });
  });

  it('未ログインの転送では一覧を読まない', async () => {
    mocks.authorize.mockRejectedValue(new Error('REDIRECT'));
    await expect(StaffExchangesPage()).rejects.toThrow('REDIRECT');
    expect(mocks.listExchanges).not.toHaveBeenCalled();
  });

  it('ロール不足は利用不可を出し一覧を読まない', async () => {
    mocks.authorize.mockResolvedValue({ kind: 'forbidden' });
    render(await StaffExchangesPage());
    expect(screen.getByText('実行委員のみ利用できます')).toBeTruthy();
    expect(mocks.listExchanges).not.toHaveBeenCalled();
  });

  it('交換済みを一覧で出す', async () => {
    mocks.listExchanges.mockResolvedValue({
      ok: true,
      usage,
      value: [
        {
          exchangeId: 1,
          visitorId: '3f2a9c1e-1111-4111-8111-111111111111',
          exchangedAt: '2026-11-14T04:42:00.000Z',
          exchangedBy: 'preview',
          cancelledAt: null,
          cancelledBy: null,
        },
      ],
    });
    render(await StaffExchangesPage());
    expect(screen.getByText('3f2a9c1e')).toBeTruthy();
  });

  it('一覧を取得できなければ例外にする', async () => {
    mocks.listExchanges.mockResolvedValue({ ok: false, usage });
    await expect(StaffExchangesPage()).rejects.toThrow();
  });
});
