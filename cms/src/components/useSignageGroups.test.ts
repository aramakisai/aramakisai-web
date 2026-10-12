import { afterEach, describe, expect, it, vi } from 'vitest';

import { getGroupsState, reloadGroups, subscribeGroups, toggleGroup } from './useSignageGroups';
import { getPinnedId } from './useSignagePin';

const doc = (id: number, is_all: boolean, visible: boolean, slides: number[] = []) => ({
  id,
  name: `g${id}`,
  visible,
  is_all,
  slides,
});

/** URL ごとに応答を返す fetch。PATCH は更新後のドキュメントを返す */
const router = (opts: { groups: ReturnType<typeof doc>[]; total: number; pinned?: number | null; failPatch?: boolean; failGet?: boolean }) =>
  vi.fn(async (url: string, init?: RequestInit) => {
    const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
    if (opts.failGet) return { ok: false } as Response;
    if (url.startsWith('/api/signage_groups?')) return ok({ docs: opts.groups });
    if (url.startsWith('/api/signage_slides?')) return ok({ totalDocs: opts.total });
    if (url.startsWith('/api/globals/signage_settings')) return ok({ pinned_slide: opts.pinned ?? null });
    if (init?.method === 'PATCH') {
      if (opts.failPatch) return { ok: false } as Response;
      const id = Number(url.match(/signage_groups\/(\d+)/)![1]);
      return ok({ doc: { ...opts.groups.find((g) => g.id === id)!, ...JSON.parse(String(init.body)) } });
    }
    throw new Error(`unexpected ${url}`);
  });

afterEach(() => vi.unstubAllGlobals());

describe('subscribeGroups', () => {
  it('グループを取得し、「すべて」を先頭にして全スライド数を持つ', async () => {
    vi.stubGlobal('fetch', router({ groups: [doc(1, false, true, [5]), doc(2, true, true)], total: 8 }));
    const off = subscribeGroups(() => {});
    await vi.waitFor(() => expect(getGroupsState().groups?.map((g) => g.id)).toEqual([2, 1]));
    expect(getGroupsState().total).toBe(8);
    off();
  });

  it('画面に入り直すたびに読み直す', async () => {
    vi.stubGlobal('fetch', router({ groups: [doc(1, true, true)], total: 1 }));
    const off = subscribeGroups(() => {});
    await vi.waitFor(() => expect(getGroupsState().total).toBe(1));
    off();
    vi.stubGlobal('fetch', router({ groups: [doc(1, true, true)], total: 3 }));
    const off2 = subscribeGroups(() => {});
    await vi.waitFor(() => expect(getGroupsState().total).toBe(3));
    off2();
  });
});

describe('reloadGroups', () => {
  it('取得に失敗したら直前の状態を保つ', async () => {
    vi.stubGlobal('fetch', router({ groups: [doc(1, true, true)], total: 4 }));
    await reloadGroups();
    vi.stubGlobal('fetch', router({ groups: [], total: 0, failGet: true }));
    await reloadGroups();
    expect(getGroupsState().total).toBe(4);
    expect(getGroupsState().groups).toHaveLength(1);
  });
});

describe('toggleGroup', () => {
  it('表示を更新して状態を置き換え、固定状態を読み直す', async () => {
    vi.stubGlobal('fetch', router({ groups: [doc(1, true, true), doc(2, false, true, [5])], total: 2, pinned: 5 }));
    await reloadGroups();
    const f = router({ groups: [doc(1, true, true), doc(2, false, true, [5])], total: 2, pinned: null });
    vi.stubGlobal('fetch', f);
    await toggleGroup(2, false);
    expect(getGroupsState().groups!.find((g) => g.id === 2)!.visible).toBe(false);
    expect(getGroupsState().failedId).toBeUndefined();
    expect(f.mock.calls.some(([u]) => String(u).startsWith('/api/globals/signage_settings'))).toBe(true);
    expect(getPinnedId()).toBeNull();
  });

  it('失敗したら状態を変えず、失敗した対象を覚える', async () => {
    vi.stubGlobal('fetch', router({ groups: [doc(1, true, true)], total: 1 }));
    await reloadGroups();
    vi.stubGlobal('fetch', router({ groups: [doc(1, true, true)], total: 1, failPatch: true }));
    await toggleGroup(1, false);
    expect(getGroupsState().groups![0].visible).toBe(true);
    expect(getGroupsState().failedId).toBe(1);
    expect(getGroupsState().saving).toBe(false);
  });

  it('保存中の再操作は無視する', async () => {
    const f = router({ groups: [doc(1, true, true)], total: 1 });
    vi.stubGlobal('fetch', f);
    await reloadGroups();
    f.mockClear();
    const p = toggleGroup(1, false);
    expect(getGroupsState().saving).toBe(true);
    await toggleGroup(1, true);
    await p;
    expect(f.mock.calls.filter(([, i]) => i?.method === 'PATCH')).toHaveLength(1);
  });
});
