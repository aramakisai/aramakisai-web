import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Navigation } from '@/cms-types';
import { navigationItemsByPhase } from './navigation';

vi.mock('./cms', () => ({ cms: { findGlobal: vi.fn() } }));

import { cms } from './cms';
import { getNavigation } from './get-navigation';

const findGlobal = vi.mocked(cms.findGlobal) as unknown as ReturnType<
  typeof vi.fn
>;

const ok = (value: unknown) => ({ ok: true, value });
const networkError = { ok: false, error: { kind: 'network', status: 0 } };

function nav(items: unknown[]): Navigation {
  return { id: 1, live: { items }, pre_event: { items } } as Navigation;
}
const item = (label: string, href: string, extra = {}) => ({
  label,
  path: href,
  color: 'primary',
  footer_column: 'site',
  ...extra,
});

describe('getNavigation', () => {
  let errorLog: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    findGlobal.mockReset();
    errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorLog.mockRestore());

  it('成功: CMS の値を変換して返し、ログを出さない', async () => {
    findGlobal.mockResolvedValueOnce(ok(nav([item('企画', '/exhibitions')])));
    const result = await getNavigation();
    expect(result.live.map((i) => i.href)).toEqual(['/exhibitions']);
    expect(errorLog).not.toHaveBeenCalled();
    expect(findGlobal).toHaveBeenCalledWith(
      'navigation',
      { depth: 1 },
      expect.objectContaining({ timeoutMs: 3000, retained: 'save' }),
    );
  });

  it('network 失敗 + 長期キーあり: 直近の正常値を返す', async () => {
    findGlobal
      .mockResolvedValueOnce(networkError)
      .mockResolvedValueOnce(ok(nav([item('前回', '/prev')])));
    const result = await getNavigation();
    expect(result.live.map((i) => i.href)).toEqual(['/prev']);
    expect(findGlobal).toHaveBeenLastCalledWith(
      'navigation',
      { depth: 1 },
      { retained: 'read' },
    );
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it('network 失敗 + 長期キーなし: コード定数を返す', async () => {
    findGlobal
      .mockResolvedValueOnce(networkError)
      .mockResolvedValueOnce({ ok: false, error: { kind: 'not_found' } });
    expect(await getNavigation()).toBe(navigationItemsByPhase);
    expect(errorLog).toHaveBeenCalledTimes(2);
  });

  it('タイムアウト: 取得失敗と同じく縮退し、例外を投げない', async () => {
    // request() は打ち切りを network (status 0) として返す
    findGlobal
      .mockResolvedValueOnce(networkError)
      .mockResolvedValueOnce({ ok: false, error: { kind: 'not_found' } });
    await expect(getNavigation()).resolves.toBe(navigationItemsByPhase);
  });

  it('参照先 null の項目は出さない', async () => {
    findGlobal.mockResolvedValueOnce(
      ok(
        nav([
          item('残る', '/ok'),
          { color: 'info', footer_column: 'site', page: null },
        ]),
      ),
    );
    expect((await getNavigation()).live.map((i) => i.label)).toEqual(['残る']);
  });

  it('子 0 件のグループは出さない', async () => {
    findGlobal.mockResolvedValueOnce(
      ok(
        nav([
          item('残る', '/ok'),
          item('空', '/x', { path: undefined, children: [{ page: null }] }),
        ]),
      ),
    );
    expect((await getNavigation()).live.map((i) => i.label)).toEqual(['残る']);
  });
});
