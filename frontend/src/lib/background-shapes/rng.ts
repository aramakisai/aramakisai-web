/**
 * FNV-1a(32bit) → mulberry32 の決定的乱数。企画カードの地 (exhibition-color.ts) と
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

/**
 * 質感原画の background-position (x, y: %)。原画の左上 (x<25% かつ y<17%) は白抜けしていて
 * 図形や地が欠けて見えるため、その範囲に入った組は引き直す。
 */
export function drawTexturePosition(rng: () => number): [number, number] {
  for (;;) {
    const x = Math.round(rng() * 10000) / 100;
    const y = Math.round(rng() * 10000) / 100;
    if (!(x < 25 && y < 17)) return [x, y];
  }
}

/** 原画を図形・カードの中で回す角度 (度、0〜360)。位置の抽選の直後に引く */
export function drawTextureRotation(rng: () => number): number {
  return Math.round(rng() * 36000) / 100;
}
