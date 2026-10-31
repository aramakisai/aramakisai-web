// bansai-aqua は出演中の info と色相が近いため割り当てない。
// Tailwind が検出できるようクラス名は完全な文字列で持つ
export const STAGE_BAND_CLASSES = [
  'bg-bansai-ochre',
  'bg-bansai-sage',
  'bg-bansai-salmon',
  'bg-bansai-wisteria',
  'bg-bansai-olive',
  'bg-bansai-rose',
] as const;

// STAGE_BAND_CLASSES と同じ順。色帯の色を 18% で color/background に重ねた不透明色
// (背景図形を透かさないため alpha でなく color-mix で混ぜる。色は tailwind.config.ts にあり CSS 変数には出ない)
export const STAGE_TINT_CLASSES = [
  'bg-[color-mix(in_srgb,theme(colors.bansai-ochre)_18%,theme(colors.background))]',
  'bg-[color-mix(in_srgb,theme(colors.bansai-sage)_18%,theme(colors.background))]',
  'bg-[color-mix(in_srgb,theme(colors.bansai-salmon)_18%,theme(colors.background))]',
  'bg-[color-mix(in_srgb,theme(colors.bansai-wisteria)_18%,theme(colors.background))]',
  'bg-[color-mix(in_srgb,theme(colors.bansai-olive)_18%,theme(colors.background))]',
  'bg-[color-mix(in_srgb,theme(colors.bansai-rose)_18%,theme(colors.background))]',
] as const;
