const URL = '/api/globals/signage_settings?depth=0';

export async function fetchPinnedId(f: typeof fetch = fetch): Promise<number | null> {
  const res = await f(URL, { credentials: 'include' });
  if (!res.ok) throw new Error('固定状態を取得できませんでした');
  const json = await res.json();
  return json.pinned_slide ?? null;
}

export async function setPinnedId(id: number | null, f: typeof fetch = fetch): Promise<void> {
  const res = await f(URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pinned_slide: id }),
  });
  if (!res.ok) throw new Error('固定表示を更新できませんでした');
}
