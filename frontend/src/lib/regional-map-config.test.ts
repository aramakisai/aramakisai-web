import { describe, expect, it } from 'vitest';
import { CAMPUS_MAP_CONFIG } from './campus-map-config';
import { REGIONAL_MAP_CONFIG } from './regional-map-config';

describe('REGIONAL_MAP_CONFIG', () => {
  it('uses the verified campus bounds for the regional initial view', () => {
    const expectedCenter = [
      (CAMPUS_MAP_CONFIG.campusBounds[0][0] +
        CAMPUS_MAP_CONFIG.campusBounds[1][0]) /
        2,
      (CAMPUS_MAP_CONFIG.campusBounds[0][1] +
        CAMPUS_MAP_CONFIG.campusBounds[1][1]) /
        2,
    ];

    expect(REGIONAL_MAP_CONFIG.initialCenter).toEqual(expectedCenter);
    expect(REGIONAL_MAP_CONFIG.initialZoom).toBe(CAMPUS_MAP_CONFIG.minZoom);
    expect(REGIONAL_MAP_CONFIG.focusZoom).toBe(
      REGIONAL_MAP_CONFIG.maxNativeZoom,
    );
  });
});
