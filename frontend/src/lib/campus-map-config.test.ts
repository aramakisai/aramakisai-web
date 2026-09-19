import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CAMPUS_MAP_CONFIG,
  MAP_ATTRIBUTION,
  MAP_BREAKPOINT,
} from './campus-map-config';

describe('CAMPUS_MAP_CONFIG', () => {
  it('ズーム範囲は下限 17・上限 19 で、初期ズームがその範囲内にある', () => {
    expect(CAMPUS_MAP_CONFIG.minZoom).toBe(17);
    expect(CAMPUS_MAP_CONFIG.maxZoom).toBe(19);
    expect(CAMPUS_MAP_CONFIG.initialZoom).toBeGreaterThanOrEqual(
      CAMPUS_MAP_CONFIG.minZoom,
    );
    expect(CAMPUS_MAP_CONFIG.initialZoom).toBeLessThanOrEqual(
      CAMPUS_MAP_CONFIG.maxZoom,
    );
  });

  it('bounds は南西・北東の順で、南 < 北・西 < 東 となる', () => {
    const [[south, west], [north, east]] = CAMPUS_MAP_CONFIG.bounds;
    expect(south).toBeLessThan(north);
    expect(west).toBeLessThan(east);
  });

  it('center は bounds の範囲内にある', () => {
    const [lat, lon] = CAMPUS_MAP_CONFIG.center;
    const [[south, west], [north, east]] = CAMPUS_MAP_CONFIG.bounds;
    expect(lat).toBeGreaterThanOrEqual(south);
    expect(lat).toBeLessThanOrEqual(north);
    expect(lon).toBeGreaterThanOrEqual(west);
    expect(lon).toBeLessThanOrEqual(east);
  });

  it('tileUrlTemplate は z/x/y のプレースホルダーを含む', () => {
    expect(CAMPUS_MAP_CONFIG.tileUrlTemplate).toContain('{z}');
    expect(CAMPUS_MAP_CONFIG.tileUrlTemplate).toContain('{x}');
    expect(CAMPUS_MAP_CONFIG.tileUrlTemplate).toContain('{y}');
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
