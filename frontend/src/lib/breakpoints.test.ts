import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LG_BREAKPOINT_PX } from './breakpoints';

describe('LG_BREAKPOINT_PX', () => {
  it('1024px である', () => {
    expect(LG_BREAKPOINT_PX).toBe(1024);
  });

  it('Tailwind の既定の `lg` ブレークポイントと一致する (要件 21.10)', () => {
    const themeCss = readFileSync(
      require.resolve('tailwindcss/theme.css'),
      'utf-8',
    );
    const match = /--breakpoint-lg:\s*([\d.]+)rem/.exec(themeCss);
    if (!match)
      throw new Error(
        'tailwindcss/theme.css に --breakpoint-lg が見つからない',
      );
    const tailwindLgPx = Number(match[1]) * 16;
    expect(LG_BREAKPOINT_PX).toBe(tailwindLgPx);
  });
});
