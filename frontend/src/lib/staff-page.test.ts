import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookie: '' as string,
  readStampEnv: vi.fn(),
  requireStaff: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ cookie: mocks.cookie }),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock('./cloudflare-env', () => ({ readStampEnv: mocks.readStampEnv }));
vi.mock('./staff-auth', () => ({ requireStaff: mocks.requireStaff }));

import { authorizeStaffPage } from './staff-page';

describe('authorizeStaffPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readStampEnv.mockResolvedValue({
      ok: true,
      env: { STAMP_ENV: 'prod' },
    });
  });

  it('未ログインならログインへ転送する (戻り先はクエリ付きのパス)', async () => {
    mocks.requireStaff.mockResolvedValue({
      kind: 'login_required',
      loginUrl: '/staff/auth/login?returnTo=%2Fstaff%2Fexchanges',
    });
    await expect(authorizeStaffPage('/staff/exchanges')).rejects.toThrow(
      'REDIRECT:/staff/auth/login?returnTo=%2Fstaff%2Fexchanges',
    );
    const req = mocks.requireStaff.mock.calls[0][0] as Request;
    expect(new URL(req.url).pathname).toBe('/staff/exchanges');
  });

  it('Cookie を認可の要求へ引き継ぐ', async () => {
    mocks.cookie = 'aramakisai_staff=abc';
    mocks.requireStaff.mockResolvedValue({ kind: 'allowed', staff: 'a@b' });
    const r = await authorizeStaffPage('/staff');
    expect(r).toMatchObject({ kind: 'allowed', staff: 'a@b' });
    const req = mocks.requireStaff.mock.calls[0][0] as Request;
    expect(req.headers.get('cookie')).toBe('aramakisai_staff=abc');
  });

  it('ロール不足は forbidden を返す', async () => {
    mocks.requireStaff.mockResolvedValue({ kind: 'forbidden' });
    expect(await authorizeStaffPage('/staff')).toEqual({ kind: 'forbidden' });
  });

  it('実行環境を読めなければ認可せず unavailable を返す', async () => {
    mocks.readStampEnv.mockResolvedValue({ ok: false, missing: ['STAMP_ENV'] });
    expect(await authorizeStaffPage('/staff')).toEqual({ kind: 'unavailable' });
    expect(mocks.requireStaff).not.toHaveBeenCalled();
  });
});
