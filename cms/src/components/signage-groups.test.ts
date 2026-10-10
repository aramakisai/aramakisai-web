import { describe, expect, it, vi } from 'vitest';

import {
  addSlideToGroup,
  fetchGroups,
  fetchSlideCount,
  isSlideVisible,
  setGroupVisible,
  sortAllFirst,
  type SignageGroup,
} from './signage-groups';

const res = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const g = (id: number, is_all: boolean, visible = true, slides: number[] = []): SignageGroup => ({
  id,
  name: `g${id}`,
  visible,
  is_all,
  slides,
});

describe('fetchGroups', () => {
  it('作成順で取得し、所属はIDの配列に正規化する', async () => {
    const f = vi.fn().mockResolvedValue(
      res({ docs: [{ id: 2, name: 'a', visible: true, is_all: false, slides: [{ id: 5 }, 6] }, { id: 1, name: 'b', visible: false, is_all: null }] }),
    );
    const groups = await fetchGroups(f);
    expect(f).toHaveBeenCalledWith('/api/signage_groups?limit=0&depth=0&sort=createdAt', { credentials: 'include' });
    expect(groups).toEqual([
      { id: 2, name: 'a', visible: true, is_all: false, slides: [5, 6] },
      { id: 1, name: 'b', visible: false, is_all: false, slides: [] },
    ]);
  });

  it('失敗したら投げる', async () => {
    await expect(fetchGroups(vi.fn().mockResolvedValue(res({}, false)))).rejects.toThrow();
  });
});

describe('fetchSlideCount', () => {
  it('全スライド数を totalDocs で取る', async () => {
    const f = vi.fn().mockResolvedValue(res({ totalDocs: 12 }));
    expect(await fetchSlideCount(f)).toBe(12);
    expect(f).toHaveBeenCalledWith('/api/signage_slides?limit=1&depth=0', { credentials: 'include' });
  });
});

describe('sortAllFirst', () => {
  it('「すべて」を先頭にし、他は元の順を保つ', () => {
    expect(sortAllFirst([g(1, false), g(2, true), g(3, false)]).map((x) => x.id)).toEqual([2, 1, 3]);
  });
});

describe('setGroupVisible', () => {
  it('表示だけを PATCH し、更新後のグループを返す', async () => {
    const f = vi.fn().mockResolvedValue(res({ doc: { id: 4, name: 'x', visible: false, is_all: false, slides: [1] } }));
    const out = await setGroupVisible(4, false, f);
    expect(f).toHaveBeenCalledWith('/api/signage_groups/4?depth=0', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visible: false }),
    });
    expect(out).toEqual({ id: 4, name: 'x', visible: false, is_all: false, slides: [1] });
  });

  it('失敗したら投げる', async () => {
    await expect(setGroupVisible(1, true, vi.fn().mockResolvedValue(res({}, false)))).rejects.toThrow();
  });
});

describe('addSlideToGroup', () => {
  it('保存済みの所属に新しいIDを足して、所属だけを PATCH する', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(res({ id: 3, slides: [1, { id: 2 }] }))
      .mockResolvedValueOnce(res({}));
    await addSlideToGroup(3, 9, f);
    expect(f).toHaveBeenNthCalledWith(1, '/api/signage_groups/3?depth=0', { credentials: 'include' });
    expect(f).toHaveBeenNthCalledWith(2, '/api/signage_groups/3?depth=0', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slides: [1, 2, 9] }),
    });
  });

  it('保存済みに同じIDがあれば重複させずに PATCH する', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(res({ id: 3, slides: [1, 9, 2] }))
      .mockResolvedValueOnce(res({}));
    await addSlideToGroup(3, 9, f);
    expect(f).toHaveBeenNthCalledWith(2, '/api/signage_groups/3?depth=0', expect.objectContaining({ body: JSON.stringify({ slides: [1, 9, 2] }) }));
  });

  it('取得・保存のどちらの失敗でも投げる', async () => {
    await expect(addSlideToGroup(3, 9, vi.fn().mockResolvedValue(res({}, false)))).rejects.toThrow();
    const f = vi.fn().mockResolvedValueOnce(res({ slides: [] })).mockResolvedValueOnce(res({}, false));
    await expect(addSlideToGroup(3, 9, f)).rejects.toThrow();
  });
});

describe('isSlideVisible', () => {
  it('有効かつ表示中のグループ(または表示中の「すべて」)に属すれば表示される', () => {
    const groups = [g(1, true, false), g(2, false, true, [10])];
    expect(isSlideVisible({ id: 10, enabled: true }, groups)).toBe(true);
    expect(isSlideVisible({ id: 11, enabled: true }, groups)).toBe(false);
    expect(isSlideVisible({ id: 10, enabled: false }, groups)).toBe(false);
    expect(isSlideVisible({ id: 11, enabled: true }, [g(1, true, true)])).toBe(true);
  });
});
