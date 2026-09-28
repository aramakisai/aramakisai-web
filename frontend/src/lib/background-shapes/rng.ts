/**
 * FNV-1a(32bit) → mulberry32 の決定的乱数。企画カードの配色 (exhibition-color.ts) と
 * 背景図形配置の参照実装 (aramakisai-refine-assets/place.py) で同じ数列を返す必要があるため、
 * 文字列は (サロゲートペアも含め) UTF-16 コード単位ごとに XOR する。JS の `charCodeAt` は
 * すでにコード単位を返すため、Python 側で 1 文字ずつ `utf-16-le` エンコードする処理と等価になる。
 */
export function fnv1a(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
