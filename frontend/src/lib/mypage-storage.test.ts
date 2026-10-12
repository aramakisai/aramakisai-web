import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addStamp, readMypageData } from './mypage-storage';

const KEY = 'aramakisai_mypage';

describe('mypage-storage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('未保存は空のリスト', () => {
    expect(readMypageData()).toEqual({ version: 1, lists: { stamps: [] } });
  });

  it('追加すると added、保存形式は版番号と名前付きリスト', () => {
    expect(addStamp(12, 'exhibit')).toBe('added');
    const raw = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(raw.version).toBe(1);
    expect(raw.lists.stamps).toHaveLength(1);
    expect(raw.lists.stamps[0]).toMatchObject({ id: 12, category: 'exhibit' });
    expect(Number.isNaN(Date.parse(raw.lists.stamps[0].savedAt))).toBe(false);
  });

  it('同じ組は exists で重複せず、別カテゴリは別の組', () => {
    addStamp(12, 'exhibit');
    expect(addStamp(12, 'exhibit')).toBe('exists');
    expect(addStamp(12, 'vendor')).toBe('added');
    expect(readMypageData()!.lists.stamps).toHaveLength(2);
  });

  it('壊れたJSONは空のリストとして読み、追加で上書きできる', () => {
    window.localStorage.setItem(KEY, '{broken');
    expect(readMypageData()).toEqual({ version: 1, lists: { stamps: [] } });
    expect(addStamp(1, 'other')).toBe('added');
  });

  it('不正な要素は捨てる', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        lists: {
          stamps: [
            { id: 1, category: 'exhibit', savedAt: '2026-11-03T10:00:00.000Z' },
            { id: 2, category: 'stage', savedAt: '2026-11-03T10:00:00.000Z' },
            {
              id: -1,
              category: 'exhibit',
              savedAt: '2026-11-03T10:00:00.000Z',
            },
            { id: 3, category: 'exhibit' },
            null,
            'x',
          ],
        },
      }),
    );
    expect(readMypageData()!.lists.stamps.map((s) => s.id)).toEqual([1]);
  });

  it('版番号が違う・形が違う値は空として扱う', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 2, lists: {} }));
    expect(readMypageData()!.lists.stamps).toEqual([]);
    window.localStorage.setItem(KEY, '[]');
    expect(readMypageData()!.lists.stamps).toEqual([]);
  });

  it('書き込みが失敗する環境では unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(addStamp(1, 'exhibit')).toBe('unavailable');
  });

  it('読み込みが例外になる環境では null と unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readMypageData()).toBeNull();
    expect(addStamp(1, 'exhibit')).toBe('unavailable');
  });
});
