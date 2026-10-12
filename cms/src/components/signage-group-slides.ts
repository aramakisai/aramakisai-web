export type SlideRow = { id: number; title: string; enabled: boolean };

export type Queries = { left: string; right: string };

/** 取得順(`_order` 順)を保ったまま、値にあるものを登録済み、無いものを未登録に分け、各列を自分の絞り込みだけで絞る。件数は絞る前の数 */
export function split(all: SlideRow[], value: number[], q: Queries) {
  const set = new Set(value);
  const unregistered = all.filter((r) => !set.has(r.id));
  const registered = all.filter((r) => set.has(r.id));
  return {
    unregistered: filterRows(unregistered, q.left),
    registered: filterRows(registered, q.right),
    unregisteredTotal: unregistered.length,
    registeredTotal: registered.length,
  };
}

export function filterRows(rows: SlideRow[], query: string): SlideRow[] {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;
}

/** 隠れた登録済みの行も値に残るよう、見えている行ではなく全スライドから値を組み直す */
export function moveValue(all: SlideRow[], value: number[], ids: number[], direction: 'add' | 'remove'): number[] {
  const next = new Set(value);
  for (const id of ids) {
    if (direction === 'add') next.add(id);
    else next.delete(id);
  }
  return all.filter((r) => next.has(r.id)).map((r) => r.id);
}

export const selectAllIds = (visible: SlideRow[]): number[] => visible.map((r) => r.id);

/** 絞り込みで隠れた行は、選択中でも移さず、ボタンの活性判定にも数えない(visible は絞り込み済みの行) */
export const movableIds = (selected: Set<number>, visible: SlideRow[]): number[] =>
  visible.map((r) => r.id).filter((id) => selected.has(id));

export const withoutMoved = (selected: Set<number>, moved: number[]): Set<number> =>
  new Set([...selected].filter((id) => !moved.includes(id)));

export async function fetchAllSlides(f: typeof fetch = fetch): Promise<SlideRow[]> {
  const res = await f('/api/signage_slides?limit=0&depth=0&sort=_order&select[title]=true&select[enabled]=true', {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('スライドを読み込めませんでした');
  return ((await res.json()).docs as { id: number; title: string; enabled?: boolean | null }[]).map((d) => ({
    id: d.id,
    title: d.title,
    enabled: Boolean(d.enabled),
  }));
}
