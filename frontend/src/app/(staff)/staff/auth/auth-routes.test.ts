import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readStampEnv: vi.fn(),
  startStaffLogin: vi.fn(),
  handleStaffCallback: vi.fn(),
}));
vi.mock('@/lib/cloudflare-env', () => ({ readStampEnv: mocks.readStampEnv }));
vi.mock('@/lib/staff-auth', () => ({
  startStaffLogin: mocks.startStaffLogin,
  handleStaffCallback: mocks.handleStaffCallback,
}));

import { GET as login } from './login/route';
import { GET as callback } from './callback/route';

const req = (p: string) => new Request(`https://example.test${p}`);

describe('管理者ログインのルート', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readStampEnv.mockResolvedValue({ ok: true, env: {} });
  });

  it('login は認可エンドポイントへ転送し Cookie を渡す', async () => {
    mocks.startStaffLogin.mockResolvedValue({
      location: 'https://idp.test/authorize',
      cookies: ['a=1'],
    });
    const res = await login(req('/staff/auth/login'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://idp.test/authorize');
    expect(res.headers.getSetCookie()).toEqual(['a=1']);
  });

  it('login の開始に失敗したらログイン失敗の画面へ', async () => {
    mocks.startStaffLogin.mockRejectedValue(new Error('x'));
    const res = await login(req('/staff/auth/login'));
    expect(new URL(res.headers.get('location')!).pathname).toBe(
      '/staff/auth/failed',
    );
  });

  it.each([
    [{ kind: 'failed' }, '/staff/auth/failed'],
    [{ kind: 'forbidden' }, '/staff/auth/forbidden'],
  ])('callback %o は %s へ', async (result, path) => {
    mocks.handleStaffCallback.mockResolvedValue(result);
    const res = await callback(req('/staff/auth/callback'));
    expect(new URL(res.headers.get('location')!).pathname).toBe(path);
  });

  it('callback 成功は戻り先へ転送しセッション Cookie を渡す', async () => {
    mocks.handleStaffCallback.mockResolvedValue({
      kind: 'ok',
      location: '/staff/visitors/x?t=1',
      cookies: ['s=1', 'o=; Max-Age=0'],
    });
    const res = await callback(req('/staff/auth/callback'));
    expect(res.headers.get('location')).toBe(
      'https://example.test/staff/visitors/x?t=1',
    );
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });
});
