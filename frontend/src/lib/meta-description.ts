export const META_DESCRIPTION_MAX_LENGTH = 120;

const HTML_TAG_PATTERN = /<[^>]*>/g;
const ENTITY_PATTERN = /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const codePoint =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

function normalize(value: string): string {
  // タグを空文字ではなく空白へ置換する。"<p>foo</p><p>bar</p>" が
  // "foobar" に連結されるのを防ぐため (直後の空白正規化で単一空白へ畳む)
  return decodeEntities(value.replace(HTML_TAG_PATTERN, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string): string {
  if (value.length <= META_DESCRIPTION_MAX_LENGTH) return value;
  return `${value.slice(0, META_DESCRIPTION_MAX_LENGTH - 1)}…`;
}

/**
 * 候補の先頭から、HTML 除去・実体参照デコード・空白正規化を経て非空になる
 * 最初の値を description として採用する。全て空なら fallback を返す。
 */
export function toMetaDescription(
  sources: readonly (string | null | undefined)[],
  fallback: string,
): string {
  for (const source of sources) {
    if (!source) continue;
    const normalized = normalize(source);
    if (normalized) return truncate(normalized);
  }
  return fallback;
}
