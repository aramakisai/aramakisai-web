import { visibleSlideIds } from '../lib/signage-visibility';

export type SignageGroup = { id: number; name: string; visible: boolean; is_all: boolean; slides: number[] };

const JSON_HEADERS = { 'content-type': 'application/json' };

type GroupDoc = { id: number; name: string; visible?: boolean | null; is_all?: boolean | null; slides?: unknown[] | null };

const toGroup = (doc: GroupDoc): SignageGroup => ({
  id: doc.id,
  name: doc.name,
  visible: Boolean(doc.visible),
  is_all: Boolean(doc.is_all),
  slides: ((doc.slides ?? []) as unknown[]).map((s) => (typeof s === 'object' && s !== null ? (s as { id: number }).id : (s as number))),
});

export async function fetchGroups(f: typeof fetch = fetch): Promise<SignageGroup[]> {
  const res = await f('/api/signage_groups?limit=0&depth=0&sort=createdAt', { credentials: 'include' });
  if (!res.ok) throw new Error('グループを取得できませんでした');
  return ((await res.json()).docs as GroupDoc[]).map(toGroup);
}

export async function fetchSlideCount(f: typeof fetch = fetch): Promise<number> {
  const res = await f('/api/signage_slides?limit=1&depth=0', { credentials: 'include' });
  if (!res.ok) throw new Error('スライド数を取得できませんでした');
  return (await res.json()).totalDocs;
}

export const sortAllFirst = (groups: SignageGroup[]): SignageGroup[] => [
  ...groups.filter((g) => g.is_all),
  ...groups.filter((g) => !g.is_all),
];

export async function setGroupVisible(id: number, visible: boolean, f: typeof fetch = fetch): Promise<SignageGroup> {
  const res = await f(`/api/signage_groups/${id}?depth=0`, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ visible }),
  });
  if (!res.ok) throw new Error('グループを更新できませんでした');
  return toGroup((await res.json()).doc);
}

/** 画面上の未保存の値は送らず、保存済みの所属に足すだけにする(他の未保存の変更は標準の保存ボタンに任せる) */
export async function addSlideToGroup(groupId: number, slideId: number, f: typeof fetch = fetch): Promise<void> {
  const url = `/api/signage_groups/${groupId}?depth=0`;
  const got = await f(url, { credentials: 'include' });
  if (!got.ok) throw new Error('所属を保存できませんでした');
  const saved = toGroup(await got.json()).slides;
  const res = await f(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ slides: [...saved, slideId] }),
  });
  if (!res.ok) throw new Error('所属を保存できませんでした');
}

export const isSlideVisible = (slide: { id: number; enabled?: boolean | null }, groups: SignageGroup[]): boolean =>
  visibleSlideIds(slide.enabled ? [slide.id] : [], groups).length > 0;
