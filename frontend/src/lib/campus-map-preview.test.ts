import { describe, expect, it } from 'vitest';
import { mergePreviewPoints } from './campus-map-preview';
import type { CampusMapPoint } from './campus-map';

describe('施設プレビューの地点統合', () => {
  it('同種・同座標のCMS地点を優先し、異なる種別と座標は維持する', () => {
    const existing: CampusMapPoint[] = [
      {
        id: 42,
        kind: 'reception',
        latitude: 36.431256,
        longitude: 139.044215,
        label: '既存受付',
      },
      { id: -1, kind: 'garbage_station', latitude: 36.43, longitude: 139.04 },
    ];
    const preview = [
      {
        kind: 'reception' as const,
        latitude: 36.431256,
        longitude: 139.044215,
      },
      {
        kind: 'garbage_station' as const,
        latitude: 36.431256,
        longitude: 139.044215,
      },
      {
        kind: 'reception' as const,
        latitude: 36.431465,
        longitude: 139.046116,
      },
    ];
    const result = mergePreviewPoints(existing, preview);
    expect(result.slice(0, 2)).toEqual(existing);
    expect(result).toHaveLength(4);
    expect(result[2]).toMatchObject(preview[1]);
    expect(result[3]).toMatchObject(preview[2]);
    expect(new Set(result.map((point) => point.id)).size).toBe(4);
    expect(existing).toHaveLength(2);
  });
});
