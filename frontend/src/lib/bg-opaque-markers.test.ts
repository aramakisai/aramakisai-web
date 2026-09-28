import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 背景図形が裏へ回ってよい「不透明な面」を持つ部品の一覧 (design.md obstacles 節の
// `[data-bg-opaque]`)。img・input/textarea/select・地を持つ button/a は自動検出されるため
// ここには含めない。ここに載る部品はいずれも背景色/画像が内側の要素にあり、
// ルート要素自身は自動検出の対象にならないため明示の印が要る (要件 7.6)
const MARKED_COMPONENTS = [
  'components/exhibition-card.tsx',
  'components/primary-nav-card.tsx',
  'components/topic-card.tsx',
  'components/sponsors-list.tsx',
  'components/access-section.tsx',
  'components/exhibition-location-map/exhibition-location-map-view.tsx',
] as const;

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('不透明な面を持つ部品の印 (data-bg-opaque)', () => {
  it.each(MARKED_COMPONENTS)('%s が印を持つ', (relativePath) => {
    const source = readFileSync(path.join(SRC_DIR, relativePath), 'utf8');
    expect(source).toContain('data-bg-opaque');
  });
});
