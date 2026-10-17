import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MYPAGE_CHANGE_EVENT,
  addBookmark,
  addStamp,
  parseMypageData,
  readMypageData,
  readMypageRaw,
  removeBookmark,
} from './mypage-storage';

const KEY = 'aramakisai_mypage';

describe('mypage-storage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('未保存は空のリスト', () => {
    expect(readMypageData()).toEqual({
      version: 1,
      lists: { stamps: [], bookmarks: [] },
    });
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
    expect(readMypageData()).toEqual({
      version: 1,
      lists: { stamps: [], bookmarks: [] },
    });
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

  describe('bookmarks', () => {
    it('追加・重複・解除の結果値', () => {
      expect(addBookmark(1, 'exhibit')).toBe('added');
      expect(addBookmark(1, 'exhibit')).toBe('exists');
      expect(addBookmark(1, 'vendor')).toBe('added');
      expect(removeBookmark(1, 'exhibit')).toBe('removed');
      expect(removeBookmark(1, 'exhibit')).toBe('absent');
      expect(readMypageData()!.lists.bookmarks).toMatchObject([
        { id: 1, category: 'vendor' },
      ]);
    });

    it('stage はブックマークできるがスタンプでは捨てられる', () => {
      expect(addBookmark(2, 'stage')).toBe('added');
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          lists: {
            stamps: [{ id: 2, category: 'stage', savedAt: 'x' }],
            bookmarks: [{ id: 2, category: 'stage', savedAt: 'x' }],
          },
        }),
      );
      const d = readMypageData()!;
      expect(d.lists.stamps).toEqual([]);
      expect(d.lists.bookmarks).toHaveLength(1);
    });

    it('スタンプ記録後もブックマークが残り、逆も同じ', () => {
      addBookmark(1, 'stage');
      addStamp(5, 'exhibit');
      expect(readMypageData()!.lists.bookmarks).toHaveLength(1);
      removeBookmark(9, 'other');
      addBookmark(3, 'other');
      removeBookmark(3, 'other');
      expect(readMypageData()!.lists.stamps).toHaveLength(1);
    });

    it('bookmarks 欠落は空、壊れた要素は捨てる', () => {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, lists: { stamps: [] } }),
      );
      expect(readMypageData()!.lists.bookmarks).toEqual([]);
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          lists: {
            bookmarks: [
              { id: 1, category: 'other', savedAt: 'x' },
              { id: 2, category: 'zzz', savedAt: 'x' },
              { id: 0, category: 'other', savedAt: 'x' },
              null,
            ],
          },
        }),
      );
      expect(readMypageData()!.lists.bookmarks.map((b) => b.id)).toEqual([1]);
      window.localStorage.setItem(KEY, '{broken');
      expect(readMypageData()!.lists.bookmarks).toEqual([]);
    });

    it('書き込み例外で unavailable', () => {
      addBookmark(1, 'exhibit');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      expect(addBookmark(2, 'exhibit')).toBe('unavailable');
      expect(removeBookmark(1, 'exhibit')).toBe('unavailable');
    });

    it('書き込み成功時に変更イベントを発火し、失敗時は発火しない', () => {
      const fn = vi.fn();
      window.addEventListener(MYPAGE_CHANGE_EVENT, fn);
      addBookmark(1, 'exhibit');
      addStamp(1, 'exhibit');
      removeBookmark(1, 'exhibit');
      expect(fn).toHaveBeenCalledTimes(3);
      addBookmark(1, 'exhibit');
      addBookmark(1, 'exhibit');
      expect(fn).toHaveBeenCalledTimes(4);
      window.removeEventListener(MYPAGE_CHANGE_EVENT, fn);
    });
  });

  it('readMypageRaw と parseMypageData', () => {
    expect(readMypageRaw()).toBeNull();
    addBookmark(1, 'exhibit');
    const raw = readMypageRaw() as string;
    expect(parseMypageData(raw).lists.bookmarks).toHaveLength(1);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readMypageRaw()).toBe('unavailable');
  });
});
