/**
 * FNV-1a(32bit) → mulberry32 の決定的乱数。企画カードの配色 (exhibition-color.ts) と
 * 背景図形配置で共用する。文字列は (サロゲートペアも含め) UTF-16 コード単位ごとに XOR する。
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
