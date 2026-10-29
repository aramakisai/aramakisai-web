import { describe, expect, it, vi } from 'vitest';
import { allowAnonymousRequest } from './rate-limit';
import type { StampEnv } from './cloudflare-env';

const envWith = (
  limit: (o: { key: string }) => Promise<{ success: boolean }>,
) => ({ STAMP_RATE_LIMITER: { limit } }) as unknown as StampEnv;
const req = (ip?: string) =>
  new Request(
    'https://x.test/',
    ip ? { headers: { 'cf-connecting-ip': ip } } : {},
  );

describe('allowAnonymousRequest', () => {
  it('接続元 IP をキーに判定する', async () => {
    const limit = vi.fn(async () => ({ success: true }));
    expect(await allowAnonymousRequest(envWith(limit), req('1.2.3.4'))).toBe(
      true,
    );
    expect(limit).toHaveBeenCalledWith({ key: '1.2.3.4' });
  });

  it('超過なら false', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    expect(await allowAnonymousRequest(envWith(limit), req('1.2.3.4'))).toBe(
      false,
    );
  });

  it('IP ヘッダが無くても判定に進む', async () => {
    const limit = vi.fn(async () => ({ success: true }));
    expect(await allowAnonymousRequest(envWith(limit), req())).toBe(true);
    expect(limit).toHaveBeenCalledWith({ key: 'unknown' });
  });

  it('制限バインディングの失敗では来場者を止めない', async () => {
    const limit = vi.fn(async () => {
      throw new Error('boom');
    });
    expect(await allowAnonymousRequest(envWith(limit), req('1.2.3.4'))).toBe(
      true,
    );
  });
});
