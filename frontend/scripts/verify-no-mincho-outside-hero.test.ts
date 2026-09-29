import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findForbiddenStrings, listSourceFiles } from './verify-source-guard';

// hero-section.tsx はテーマ語の差し替え (tasks.md 3.1) までは明朝体の参照を残す
const HERO_SECTION = path.join('components', 'hero-section.tsx');
const SRC_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
);
const FORBIDDEN = ['Zen_Old_Mincho', 'zen-old-mincho', 'font-mincho'];

describe('明朝体の撤去', () => {
  it('hero-section.tsx を除く src に明朝体への参照が無い', () => {
    const files = listSourceFiles(
      SRC_DIR,
      ['.ts', '.tsx', '.css'],
      [HERO_SECTION],
    );

    const violations = findForbiddenStrings(files, FORBIDDEN);

    expect(violations).toEqual([]);
  });
});
