import type { ReactNode } from 'react';

// 一覧の行は祖先に別の `group` (details など) を持ち得るため、行用は名前付きの group/row で受ける
const SCALE_CLASS = {
  default: 'group-hover:scale-x-100 group-focus-visible:scale-x-100',
  row: 'group-hover/row:scale-x-100 group-focus-visible/row:scale-x-100',
} as const;

export function HoverLine({
  variant = 'default',
  gap,
}: {
  readonly variant?: keyof typeof SCALE_CLASS;
  /** 親ボックス下端から線の上端までの距離 (px、または em 等の CSS 長さ)。省略すると線の下端を親の下端に合わせる */
  readonly gap?: number | string;
}) {
  return (
    <span
      aria-hidden="true"
      style={
        gap === undefined
          ? undefined
          : {
              bottom:
                typeof gap === 'number' ? -(gap + 1) : `calc(-1px - ${gap})`,
            }
      }
      className={`mansai-spectrum-line absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 opacity-70 transition-transform duration-200 motion-reduce:transition-none ${SCALE_CLASS[variant]}`}
    />
  );
}

/**
 * 行全体のホバーで、文字の実幅の直下に線を出す。折り返したときはブロック幅になり、最終行の下に出る。
 * gap は Figma の「グリフ下端から約 9.7px」を行高ごとに換算した値 (行高 22px: 5 / 26・27px: 3)
 */
export function HoverLineText({
  children,
  gap,
  className = '',
}: {
  readonly children: ReactNode;
  readonly gap: number;
  readonly className?: string;
}) {
  return (
    <span className={`relative inline-block max-w-full align-top ${className}`}>
      {children}
      <HoverLine variant="row" gap={gap} />
    </span>
  );
}
