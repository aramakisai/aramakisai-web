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

// 長いものを先にマッチさせる(部分一致で法人格が欠けないように)
const CORPORATE_TOKENS = [
  '特定非営利活動法人',
  '一般社団法人',
  '公益社団法人',
  '一般財団法人',
  '公益財団法人',
  '社会福祉法人',
  '株式会社',
  '有限会社',
  '合同会社',
  '合資会社',
  '合名会社',
  '医療法人',
  '学校法人',
  'NPO法人',
  '（株）',
  '（有）',
  '(株)',
  '(有)',
  '㈱',
  '㈲',
];
const TOKEN_SPLIT = new RegExp(
  `(${CORPORATE_TOKENS.map((t) => t.replace(/[()]/g, '\\$&')).join('|')})`,
);

const NO_LINE_START =
  /^[・、。，．）」』】〕〉》ー々ゝゞっゃゅょァィゥェォッャュョ]+/;

/** 行頭に置けない文字で始まる塊は、その文字を直前の塊の末尾へ移す */
function applyKinsoku(parts: string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const head = out.length > 0 ? NO_LINE_START.exec(part)?.[0] : undefined;
    if (head) {
      out[out.length - 1] += head;
      const rest = part.slice(head.length);
      if (rest) out.push(rest);
    } else {
      out.push(part);
    }
  }
  return out;
}

// 上の段ほど優先。枠幅を超える塊だけを次の段で割る
const SPLITTERS: readonly ((text: string) => string[])[] = [
  (t) => t.split(TOKEN_SPLIT).filter(Boolean),
  (t) => parser.parse(t),
  splitWords,
];

function splitChunk(
  chunk: string,
  frameWidth: number,
  measure: MeasureText,
  level = 0,
): string[] {
  if (measure(chunk) <= frameWidth || level >= SPLITTERS.length) return [chunk];
  const pieces = applyKinsoku(SPLITTERS[level](chunk));
  if (pieces.length === 1)
    return splitChunk(chunk, frameWidth, measure, level + 1);
  return pieces.flatMap((p) => splitChunk(p, frameWidth, measure, level + 1));
}

export interface SponsorNameLayout {
  /** 塊と空白の並び。空白は通常の改行機会、塊の中は改行しない */
  readonly parts: readonly string[];
  /** 最長の塊が枠に入らないときだけ 1 未満。社名全体を横にだけ縮める倍率 */
  readonly scale: number;
  readonly lines: number;
}

/** 表示(CSS)と同じ規則で数える: 文節内は改行せず、文節単位で枠幅(=枠幅/scale の未縮小幅)に貪欲に詰める */
export function layoutSponsorName(
  name: string,
  frameWidth: number,
  measure: MeasureText,
): SponsorNameLayout {
  const parts = name
    .split(SPACES)
    .filter(Boolean)
    .flatMap((p) =>
      isSpacePart(p) ? [p] : splitChunk(p, frameWidth, measure),
    );
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
