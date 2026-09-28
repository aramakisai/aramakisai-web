export type Platform = 'pc' | 'sp';
export type Tier = 'Inf' | 'L' | 'S';
export type ShapeKind = 'circle' | 'triangle' | 'square' | 'roundedSquare' | 'quarterCircle' | 'semicircle';
export type TextureFamily = 'gradient' | 'watercolor' | 'grainy' | 'halftone';
export type TextureId = `L${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` | `S${1 | 2 | 3 | 4 | 5 | 6}`;
// 乱数で選ぶ候補配列が place.py と同じ並び・同じ値である必要があるため、接頭辞なしの名前を使う。
// Tailwind の bansai-* への対応は描画側で行う
export type RingColor = 'ochre' | 'olive' | 'sage' | 'salmon' | 'rose' | 'wisteria' | 'aqua';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// place.py の入力 JSON (fixture) と同じ平坦な形。fixture をそのまま読み込めるようにする
export interface PlacementInput {
  pathname: string;
  platform: Platform;
  width: number;
  height: number;
  decorTop: number; // ヘッダー (ヒーローがあればその) 下端
  decorBottom: number; // フッター (SP は下部タブナビ) 上端
  text: readonly Rect[]; // 黒文字の外接矩形
  noOverlap: readonly Rect[]; // 文字リンク・白文字・ロゴ
  opaque: readonly Rect[]; // 不透明な面
}

// place.py の出力 (shapes.json の shapes) と同じ形。golden と直接比較する。
// Inf の size は直径 D、rot は度。座標は小数第 2 位に丸める
export type PlacedShape =
  | {
      tier: 'Inf';
      kind: 'ring';
      size: number;
      cx: number;
      cy: number;
      rot: number;
      texture: null;
      colors: readonly [RingColor, RingColor];
    }
  | {
      tier: 'L' | 'S';
      kind: ShapeKind;
      size: number;
      cx: number;
      cy: number;
      rot: number;
      texture: TextureId;
      colors: null;
    };

export interface PlacementResult {
  shapes: readonly PlacedShape[];
  target: Readonly<Record<Tier, number>>;
  deficit: Readonly<Record<Tier, number>>;
}
