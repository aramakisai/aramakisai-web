import { describe, expect, it, vi } from 'vitest';

import {
  fetchAllSlides,
  filterRows,
  movableIds,
  moveValue,
  selectAllIds,
  split,
  withoutMoved,
  type SlideRow,
} from './signage-group-slides';

const s = (id: number, title: string, enabled = true): SlideRow => ({ id, title, enabled });
const all = [s(1, 'Opening'), s(2, 'Sponsors'), s(3, 'opening Map'), s(4, 'Parking', false)];

describe('split', () => {
  it('値に無いものを未登録、あるものを登録済みに、どちらも取得順(_order順)で振り分ける', () => {
    const { unregistered, registered } = split(all, [4, 2], { left: '', right: '' });
    expect(unregistered.map((r) => r.id)).toEqual([1, 3]);
    expect(registered.map((r) => r.id)).toEqual([2, 4]);
  });
  it('左の絞り込みは未登録だけ、右の絞り込みは登録済みだけを絞り、件数は絞る前の数', () => {
    const r = split(all, [3, 4], { left: 'spon', right: 'open' });
    expect(r.unregistered.map((x) => x.id)).toEqual([2]);
    expect(r.registered.map((x) => x.id)).toEqual([3]);
    expect([r.unregisteredTotal, r.registeredTotal]).toEqual([2, 2]);
  });
});

describe('filterRows', () => {
  it('題名の部分一致で、大文字・小文字を区別しない', () => {
    expect(filterRows(all, 'OPEN').map((r) => r.id)).toEqual([1, 3]);
  });
  it('空や空白だけなら絞らない', () => {
    expect(filterRows(all, '').length).toBe(4);
    expect(filterRows(all, '  ').length).toBe(4);
  });
});

describe('moveValue', () => {
  it('追加後の値を _order 順で返す', () => {
    expect(moveValue(all, [4], [3, 1], 'add')).toEqual([1, 3, 4]);
  });
  it('外した後の値を _order 順で返す', () => {
    expect(moveValue(all, [1, 3, 4], [3], 'remove')).toEqual([1, 4]);
  });
  it('絞り込みで隠れた登録済みは値に残る(移す対象に含めない限り)', () => {
    expect(moveValue(all, [2, 4], [1], 'add')).toEqual([1, 2, 4]);
  });
});

describe('selectAllIds', () => {
  it('渡された(絞り込み済みの)行をすべて選ぶ', () => {
    expect(selectAllIds(filterRows(all, 'open'))).toEqual([1, 3]);
  });
});

describe('movableIds', () => {
  it('選択のうち、渡された(いま見えている)行だけを移す。隠れた選択中の行は含めない', () => {
    expect(movableIds(new Set([1, 2, 3]), filterRows(all, 'open'))).toEqual([1, 3]);
  });
  it('選択が無ければ空(ボタンを押せない判定に使う)', () => {
    expect(movableIds(new Set(), all)).toEqual([]);
    expect(movableIds(new Set([2]), filterRows(all, 'open'))).toEqual([]);
  });
});

describe('withoutMoved', () => {
  it('移した行の選択を外し、他の選択は残す', () => {
    expect([...withoutMoved(new Set([1, 2, 3]), [1, 3])]).toEqual([2]);
  });
});

describe('fetchAllSlides', () => {
  it('全スライドの題名と有効を _order 順で取る', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ docs: [{ id: 1, title: 'a', enabled: true }, { id: 2, title: 'b' }] }),
    });
    expect(await fetchAllSlides(f)).toEqual([s(1, 'a'), s(2, 'b', false)]);
    expect(f).toHaveBeenCalledWith(
      '/api/signage_slides?limit=0&depth=0&sort=_order&select[title]=true&select[enabled]=true',
      { credentials: 'include' },
    );
  });
  it('失敗したら投げる', async () => {
    await expect(fetchAllSlides(vi.fn().mockResolvedValue({ ok: false }))).rejects.toThrow();
  });
});
