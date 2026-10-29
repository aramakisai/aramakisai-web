import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  loadAllRecords: vi.fn(),
  catalog: vi.fn(),
  record: vi.fn(),
}));
vi.mock('@/lib/staff-page', () => ({ authorizeStaffPage: mocks.authorize }));
vi.mock('@/lib/stamp-db', () => ({
  createStampRepository: () => ({ loadAllRecords: mocks.loadAllRecords }),
}));
vi.mock('@/lib/exhibitions', () => ({
  getExhibitionCatalog: mocks.catalog,
  CATEGORY_LABELS: {
    stage: 'ステージ',
    exhibit: '展示',
    vendor: '出店',
    other: 'その他',
  },
}));
vi.mock('@/lib/stamp-metrics', () => ({ recordRequest: mocks.record }));

import StaffDashboardPage from './page';

const usage = { rowsRead: 1, rowsWritten: 0, durationMs: 1 };

describe('StaffDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({
      kind: 'allowed',
      env: {},
      staff: 'preview',
    });
    mocks.catalog.mockResolvedValue({
      cards: [
        { id: 1, category: 'exhibit', displayName: '写真展', areaIds: [10] },
      ],
      areas: [{ id: 10, name: '中央エリア' }],
    });
  });

  it('未ログインの転送は認可が投げるため、記録は読まれない', async () => {
    mocks.authorize.mockRejectedValue(new Error('REDIRECT'));
    await expect(StaffDashboardPage()).rejects.toThrow('REDIRECT');
    expect(mocks.loadAllRecords).not.toHaveBeenCalled();
  });

  it('ロール不足は利用不可を出し記録を読まない', async () => {
    mocks.authorize.mockResolvedValue({ kind: 'forbidden' });
    render(await StaffDashboardPage());
    expect(screen.getByText('実行委員のみ利用できます')).toBeTruthy();
    expect(mocks.loadAllRecords).not.toHaveBeenCalled();
  });

  it('集計の値を表示する', async () => {
    mocks.loadAllRecords.mockResolvedValue({
      ok: true,
      usage,
      value: {
        stamps: [
          {
            visitorId: 'a',
            exhibitionId: 1,
            category: 'exhibit',
            acquiredAt: 't',
          },
          {
            visitorId: 'b',
            exhibitionId: 1,
            category: 'exhibit',
            acquiredAt: 't',
          },
        ],
        activeExchangeCount: 1,
      },
    });
    render(await StaffDashboardPage());
    expect(screen.getByText('参加端末')).toBeTruthy();
    expect(screen.getByText('2台 100%')).toBeTruthy();
    expect(screen.getByText('写真展')).toBeTruthy();
    expect(screen.getByText('2台')).toBeTruthy();
  });

  it('記録を取得できなければ値を出さず再読み込みを案内する', async () => {
    mocks.loadAllRecords.mockResolvedValue({ ok: false, usage });
    render(await StaffDashboardPage());
    expect(screen.getByText('集計を取得できませんでした')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: '再読み込み' }).getAttribute('href'),
    ).toBe('/staff');
    expect(screen.queryByText('参加端末')).toBeNull();
    expect(mocks.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        endpoint: 'staff_dashboard',
        outcome: 'failed',
        status: 503,
        d1Failed: true,
      }),
    );
  });

  it('カタログの取得失敗は D1 の失敗として記録しない', async () => {
    mocks.loadAllRecords.mockResolvedValue({
      ok: true,
      usage,
      value: { stamps: [], activeExchangeCount: 0 },
    });
    mocks.catalog.mockRejectedValue(new Error('cms down'));
    render(await StaffDashboardPage());
    expect(screen.getByText('集計を取得できませんでした')).toBeTruthy();
    expect(mocks.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        endpoint: 'staff_dashboard',
        outcome: 'error',
        status: 503,
        usage,
        d1Failed: false,
      }),
    );
  });
});
