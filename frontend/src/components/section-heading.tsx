import React from 'react';

export type SectionHeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';

export interface SectionHeadingProps {
  level: SectionHeadingLevel;
  children: React.ReactNode;
  className?: string;
}

// 文字サイズ・行高は globals.css の h1〜h4 基底スタイル (Figma `SectionHeading` 208:118
// の Level=h1〜h4 と同一の値) にタグ選択子経由で委ね、ここでは持たない。
// 基底スタイルの py はブレークポイントごとに段階的な値を持ち、見出しと本文の間隔を
// Figma の 24px に固定できないため py-0 で打ち消し、mb-6 (24px) を本部品側で持つ。
export function SectionHeading({
  level,
  children,
  className,
}: SectionHeadingProps) {
  const Heading = level;

  return (
    <Heading className={['py-0 mb-6', className].filter(Boolean).join(' ')}>
      {children}
    </Heading>
  );
}
