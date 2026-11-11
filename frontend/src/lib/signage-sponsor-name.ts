import { loadDefaultJapaneseParser } from 'budoux';

export type MeasureText = (text: string) => number;

export const SPONSOR_NAME_FONT_PX = 24;
export const SPONSOR_NAME_LINE_PX = 30;

/** canvas が使えない環境(SSR・テスト)用。全角幅とみなす */
export const fallbackMeasure: MeasureText = (text) =>
  text.length * SPONSOR_NAME_FONT_PX;

const parser = loadDefaultJapaneseParser();

const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
const KATAKANA = /^[\u30A0-\u30FF\u31F0-\u31FF]+$/;
const HIRAGANA = /^[\u3041-\u309F]+$/;
const kindOf = (w: string) =>
  KATAKANA.test(w) ? 'k' : HIRAGANA.test(w) ? 'h' : null;

/** ICU は未知のカタカナ語を細かく割るため、同じ文字種(カタカナ・ひらがな)が続く単語は 1 語に戻す */
function splitWords(text: string): string[] {
  const out: string[] = [];
  let prev: string | null = null;
  for (const { segment } of segmenter.segment(text)) {
    const kind = kindOf(segment);
    if (kind && kind === prev) out[out.length - 1] += segment;
    else out.push(segment);
    prev = kind;
  }
  return out;
}

const SPACES = /([ \u3000]+)/;

export const isSpacePart = (part: string) => /^[ \u3000]+$/.test(part);

export interface SponsorNameLayout {
  /** 文節と空白の並び。空白は通常の改行機会、文節の中は改行しない */
  readonly parts: readonly string[];
  /** 最長文節が枠に入らないときだけ 1 未満。社名全体を横にだけ縮める倍率 */
  readonly scale: number;
  readonly lines: number;
}

/** 表示(CSS)と同じ規則で数える: 文節内は改行せず、文節単位で枠幅(=枠幅/scale の未縮小幅)に貪欲に詰める */
export function layoutSponsorName(
  name: string,
  frameWidth: number,
  measure: MeasureText,
): SponsorNameLayout {
  const parts = parser
    .parse(name)
    .flatMap((p) => p.split(SPACES))
    .flatMap((p) =>
      isSpacePart(p) || measure(p) <= frameWidth ? [p] : splitWords(p),
    )
    .filter(Boolean);
  const longest = Math.max(
    0,
    ...parts.filter((p) => !isSpacePart(p)).map((p) => measure(p)),
  );
  const scale = longest > frameWidth ? frameWidth / longest : 1;
  const limit = frameWidth / scale;
  let lines = 0;
  let line = '';
  for (const p of parts) {
    if (isSpacePart(p)) {
      if (line) line += p;
    } else if (line && measure((line + p).trimEnd()) > limit) {
      lines += 1;
      line = p;
    } else {
      line += p;
    }
  }
  return { parts, scale, lines: line ? lines + 1 : lines };
}
