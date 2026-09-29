import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findForbiddenStrings, listSourceFiles } from './verify-source-guard';

const SRC_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
);
// bg-primary / border-primary (選択状態・現在地の塗り・線) は対象外。
// 文字色としての token 使用だけを禁止する
const FORBIDDEN = ['text-primary', 'text-gray-500'];

describe('文字色トークンの置き換え (要件 2.1, 2.2)', () => {
  it('src に文字色としての color/primary・gray-500 が無い', () => {
    const files = listSourceFiles(SRC_DIR, ['.ts', '.tsx', '.css']);

    const violations = findForbiddenStrings(files, FORBIDDEN);

    expect(violations).toEqual([]);
  });
});
