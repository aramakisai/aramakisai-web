import { loadDefaultJapaneseParser } from 'budoux';

export type MeasureText = (text: string) => number;

export const SPONSOR_NAME_FONT_PX = 24;
export const SPONSOR_NAME_LINE_PX = 30;

/** canvas が使えない環境(SSR・テスト)用。全角幅とみなす */
export const fallbackMeasure: MeasureText = (text) =>
  text.length * SPONSOR_NAME_FONT_PX;

const parser = loadDefaultJapaneseParser();

export interface SponsorNameLayout {
  readonly phrases: readonly string[];
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
  const phrases = parser.parse(name);
  const longest = Math.max(0, ...phrases.map((p) => measure(p.trimEnd())));
  const scale = longest > frameWidth ? frameWidth / longest : 1;
  const limit = frameWidth / scale;
  let lines = 0;
  let line = '';
  for (const p of phrases) {
    if (line && measure((line + p).trimEnd()) > limit) {
      lines += 1;
      line = p;
    } else {
      line += p;
    }
  }
  return { phrases, scale, lines: line ? lines + 1 : lines };
}
