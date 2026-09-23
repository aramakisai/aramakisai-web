import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { SectionHeading } from './section-heading';

describe('SectionHeading', () => {
  test.each([
    ['h1', 1],
    ['h2', 2],
    ['h3', 3],
    ['h4', 4],
  ] as const)(
    'level=%s: 対応する見出しレベルのタグで描画する',
    (level, ariaLevel) => {
      render(<SectionHeading level={level}>見出し</SectionHeading>);

      const heading = screen.getByRole('heading', {
        level: ariaLevel,
        name: '見出し',
      });
      expect(heading.tagName).toBe(level.toUpperCase());
    },
  );

  test('文字スタイルはグローバル CSS の h1〜h4 の基底スタイルに委ね、独自の文字サイズクラスを持たない', () => {
    render(<SectionHeading level="h2">見出し</SectionHeading>);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.className).not.toMatch(/text-\[/);
  });

  test('見出しと本文の間隔として mb-6 (Tailwind spacing 6 = 24px、Figma spacing/6) を持つ', () => {
    const themeCss = readFileSync(
      require.resolve('tailwindcss/theme.css'),
      'utf-8',
    );
    const match = /--spacing:\s*([\d.]+)rem/.exec(themeCss);
    if (!match)
      throw new Error('tailwindcss/theme.css に --spacing が見つからない');
    const spacingPx = Number(match[1]) * 16;
    expect(spacingPx * 6).toBe(24);

    render(<SectionHeading level="h2">見出し</SectionHeading>);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveClass('mb-6');
  });

  test('グローバル CSS の基底 py と二重にならないよう、見出し自身の上下 padding を打ち消す', () => {
    render(<SectionHeading level="h2">見出し</SectionHeading>);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveClass('py-0');
  });

  test('className を渡すと追加のクラスとして反映される', () => {
    render(
      <SectionHeading level="h3" className="text-center">
        見出し
      </SectionHeading>,
    );

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveClass('text-center');
    expect(heading).toHaveClass('mb-6');
  });
});
