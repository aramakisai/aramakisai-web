import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  getVisitorRecord: vi.fn(),
  verify: vi.fn(),
  catalog: vi.fn(),
}));
vi.mock('@/lib/staff-page', () => ({ authorizeStaffPage: mocks.authorize }));
vi.mock('@/lib/stamp-db', () => ({
  createStampRepository: () => ({ getVisitorRecord: mocks.getVisitorRecord }),
}));
vi.mock('@/lib/stamp-metrics', () => ({ recordRequest: vi.fn() }));
vi.mock('@/lib/exchange-token', () => ({
  verifyExchangeToken: mocks.verify,
}));
vi.mock('@/lib/exhibitions', () => ({ getExhibitionCatalog: mocks.catalog }));

import StaffVisitorPage from './page';

const ID = '3f2a9c1e-1111-4111-8111-111111111111';
const usage = { rowsRead: 1, rowsWritten: 0, durationMs: 1 };
const props = (id: string, t?: string) => ({
  params: Promise.resolve({ visitorId: id }),
  searchParams: Promise.resolve(t === undefined ? {} : { t }),
});

describe('StaffVisitorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({
      kind: 'allowed',
      env: { STAMP_SIGNING_SECRET: 's' },
      staff: 'preview',
    });
    mocks.verify.mockResolvedValue('valid');
    mocks.catalog.mockResolvedValue({
      areas: [{ id: 1, name: '中央エリア' }],
      cards: [
        {
          id: 1,
          category: 'exhibit',
          displayName: 'A',
          areaIds: [1],
        },
      ],
    });
  });

  it('未ログインの転送では照会しない', async () => {
    mocks.authorize.mockRejectedValue(new Error('REDIRECT'));
    await expect(StaffVisitorPage(props(ID, 'x'))).rejects.toThrow('REDIRECT');
    expect(mocks.getVisitorRecord).not.toHaveBeenCalled();
  });

  it('匿名IDの形式不正は読み取り直しを案内し照会しない', async () => {
    render(await StaffVisitorPage(props('bad', 'x')));
    expect(
      screen.getByText('QRを読み取れませんでした。読み取り直してください'),
    ).toBeTruthy();
    expect(mocks.getVisitorRecord).not.toHaveBeenCalled();
  });

  it.each(['expired', 'invalid'])(
    '署名が %s なら表示し直しを案内し照会しない',
    async (check) => {
      mocks.verify.mockResolvedValue(check);
      render(await StaffVisitorPage(props(ID, 'x')));
      expect(screen.getByText(/交換用QRの有効期限が切れています/)).toBeTruthy();
      expect(mocks.getVisitorRecord).not.toHaveBeenCalled();
    },
  );

  it('署名が無ければ照会しない', async () => {
    mocks.verify.mockResolvedValue('invalid');
    render(await StaffVisitorPage(props(ID)));
    expect(mocks.getVisitorRecord).not.toHaveBeenCalled();
  });

  it('未交換でそろっていれば登録ボタンを出す', async () => {
    mocks.getVisitorRecord.mockResolvedValue({
      ok: true,
      usage,
      value: {
        stamps: [
          {
            exhibitionId: 1,
            category: 'exhibit',
            acquiredAt: '2026-11-14T01:00:00Z',
          },
        ],
        activeExchange: null,
      },
    });
    render(await StaffVisitorPage(props(ID, 'x')));
    expect(screen.getByText('ID 3f2a9c1e')).toBeTruthy();
    expect(screen.getAllByText('1件').length).toBe(2);
    expect(screen.getByRole('button', { name: '交換済みにする' })).toBeTruthy();
  });

  it('条件未達は登録ボタンの代わりに案内を出す', async () => {
    mocks.getVisitorRecord.mockResolvedValue({
      ok: true,
      usage,
      value: { stamps: [], activeExchange: null },
    });
    render(await StaffVisitorPage(props(ID, 'x')));
    expect(
      screen.getByText('すべての企画のスタンプがそろっていません'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: '交換済みにする' })).toBeNull();
  });

  it('D1 の失敗は例外にする', async () => {
    mocks.getVisitorRecord.mockResolvedValue({ ok: false, usage });
    await expect(StaffVisitorPage(props(ID, 'x'))).rejects.toThrow();
  });
});
