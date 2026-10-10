import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadForIsr } from './isr';

describe('loadForIsr', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('取得できればその値を返す', async () => {
    await expect(loadForIsr(async () => 1, 0)).resolves.toBe(1);
  });

  it('実行時の失敗は例外のまま伝える', async () => {
    await expect(
      loadForIsr(async () => {
        throw new Error('cms down');
      }, 0),
    ).rejects.toThrow('cms down');
  });

  it('ビルド時の失敗は空値に置き換える', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    await expect(
      loadForIsr(async () => {
        throw new Error('cms down');
      }, 0),
    ).resolves.toBe(0);
  });
});
