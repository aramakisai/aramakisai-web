/**
 * Payload orderable の `_order` を昇順に比べる。未設定 (null) は末尾。
 * キーは 0-9a-z の小文字だけなので、localeCompare ではなく大小比較にして Postgres の並びと一致させる。
 */
export function compareOrderKey(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  if (a == null || b == null) return Number(a == null) - Number(b == null);
  return a < b ? -1 : a > b ? 1 : 0;
}
