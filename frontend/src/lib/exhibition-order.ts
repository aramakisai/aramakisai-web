export type OrderSeed = number;

const SEED_KEY = 'aramakisai_exhibition_order_seed';

function parseSeed(raw: string | null): OrderSeed | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n < 2 ** 32 ? n : null;
}

export function readOrCreateSeed(): OrderSeed {
  try {
    const stored = parseSeed(window.sessionStorage.getItem(SEED_KEY));
    if (stored !== null) return stored;
  } catch {
    // sessionStorage が使えない環境でも下で作ったシードを返す
  }
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  try {
    window.sessionStorage.setItem(SEED_KEY, String(seed));
  } catch {
    // 保存できなくてもこの表示の間は同じシードで並べられる
  }
  return seed;
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function orderCards<
  T extends { readonly id: number; readonly category: string },
>(cards: readonly T[], seed: OrderSeed): readonly T[] {
  return cards
    .map((card) => {
      const key = `${seed}:${card.id}:${card.category}`;
      return { card, key, hash: fnv1a(key) };
    })
    .sort((a, b) =>
      a.hash !== b.hash
        ? a.hash - b.hash
        : a.key < b.key
          ? -1
          : a.key > b.key
            ? 1
            : 0,
    )
    .map((x) => x.card);
}
