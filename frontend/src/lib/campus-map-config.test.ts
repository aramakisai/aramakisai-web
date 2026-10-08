import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CAMPUS_MAP_CONFIG,
  MAP_ATTRIBUTION,
  MAP_BREAKPOINT,
} from './campus-map-config';

describe('CAMPUS_MAP_CONFIG', () => {
  it('表示ズームはタイルの実在範囲を内包し、電子ズームできる上限を持つ', () => {
    const c = CAMPUS_MAP_CONFIG;
    expect(c.minNativeZoom).toBe(16);
    expect(c.maxNativeZoom).toBe(19);
    expect(c.minZoom).toBeLessThanOrEqual(c.minNativeZoom);
    expect(c.maxZoom).toBeGreaterThan(c.maxNativeZoom);
  });

  it('bounds は南西・北東の順で、南 < 北・西 < 東 となる', () => {
    const [[south, west], [north, east]] = CAMPUS_MAP_CONFIG.bounds;
    expect(south).toBeLessThan(north);
    expect(west).toBeLessThan(east);
  });

  it('campusBounds は bounds の範囲内にある', () => {
    const [[s0, w0], [n0, e0]] = CAMPUS_MAP_CONFIG.campusBounds;
    const [[south, west], [north, east]] = CAMPUS_MAP_CONFIG.bounds;
    expect(s0).toBeGreaterThanOrEqual(south);
    expect(n0).toBeLessThanOrEqual(north);
    expect(w0).toBeGreaterThanOrEqual(west);
    expect(e0).toBeLessThanOrEqual(east);
  });

  it('tileUrlTemplate は z/x/y のプレースホルダーを含む', () => {
    expect(CAMPUS_MAP_CONFIG.tileUrlTemplate).toContain('{z}');
    expect(CAMPUS_MAP_CONFIG.tileUrlTemplate).toContain('{x}');
    expect(CAMPUS_MAP_CONFIG.tileUrlTemplate).toContain('{y}');
  });

  it('tileUrlTemplate は webp 配信を指す', () => {
    expect(CAMPUS_MAP_CONFIG.tileUrlTemplate).toMatch(/\.webp$/);
  });
});

describe('MAP_ATTRIBUTION', () => {
  it('文字列部分が「© OpenStreetMap contributors」と一致する', () => {
    const textOnly = MAP_ATTRIBUTION.replace(/<[^>]+>/g, '');
    expect(textOnly).toBe('© OpenStreetMap contributors');
  });

  it('ライセンス情報ページへのリンクを含む', () => {
    expect(MAP_ATTRIBUTION).toContain(
      'href="https://www.openstreetmap.org/copyright"',
    );
  });
});

describe('MAP_BREAKPOINT', () => {
  it('Tailwind のブレークポイント名 md と対応する', () => {
    expect(MAP_BREAKPOINT).toBe('md');
  });
});

describe('依存の禁止', () => {
  it('cms.ts / env.ts を含め、他のアプリケーションコードを import していない', () => {
    const filePath = path.resolve(__dirname, './campus-map-config.ts');
    const source = readFileSync(filePath, 'utf-8');
    const importLines = source
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line));
    expect(importLines).toEqual([]);
  });
});
