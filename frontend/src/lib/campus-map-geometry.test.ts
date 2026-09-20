import { describe, it, expect } from 'vitest';
import {
  parsePolygonGeometry,
  polygonCentroid,
  polygonGeometrySchema,
  type PolygonGeometry,
} from './campus-map-geometry';

const squareGeometry: PolygonGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [139.0, 35.0],
      [139.0, 35.1],
      [139.1, 35.1],
      [139.1, 35.0],
      [139.0, 35.0],
    ],
  ],
};

describe('parsePolygonGeometry', () => {
  it('正当な Polygon を valid として受け入れる', () => {
    const result = parsePolygonGeometry(squareGeometry);
    expect(result.kind).toBe('valid');
    if (result.kind === 'valid') {
      expect(result.value).toEqual(squareGeometry);
    }
  });

  it('高度付き座標 (第 3 要素) を受け入れて無視する', () => {
    const withAltitude = {
      type: 'Polygon',
      coordinates: [
        [
          [139.0, 35.0, 10],
          [139.0, 35.1, 12],
          [139.1, 35.1, 8],
          [139.1, 35.0, 9],
          [139.0, 35.0, 10],
        ],
      ],
    };
    const result = parsePolygonGeometry(withAltitude);
    expect(result.kind).toBe('valid');
  });

  it('経度・緯度が範囲外の座標を拒否する', () => {
    const outOfRange = {
      type: 'Polygon',
      coordinates: [
        [
          [200, 35.0],
          [139.0, 35.1],
          [139.1, 35.1],
          [200, 35.0],
        ],
      ],
    };
    expect(parsePolygonGeometry(outOfRange).kind).toBe('invalid');
  });

  it('外環が閉じていない (始点と終点が一致しない) 場合を拒否する', () => {
    const unclosed = {
      type: 'Polygon',
      coordinates: [
        [
          [139.0, 35.0],
          [139.0, 35.1],
          [139.1, 35.1],
          [139.1, 35.0],
        ],
      ],
    };
    expect(parsePolygonGeometry(unclosed).kind).toBe('invalid');
  });

  it.each([
    null,
    undefined,
    'not a polygon',
    42,
    { type: 'Polygon', coordinates: 'invalid' },
  ])('配列でない/不正な値 %p を拒否する', (value) => {
    expect(parsePolygonGeometry(value).kind).toBe('invalid');
  });

  it('失敗時に理由 (reason) を保持する', () => {
    const result = parsePolygonGeometry(null);
    if (result.kind !== 'invalid') {
      throw new Error('invalid になるはず');
    }
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

describe('polygonGeometrySchema', () => {
  it('独立して export されており、単体で検証に使える', () => {
    expect(polygonGeometrySchema.safeParse(squareGeometry).success).toBe(true);
  });
});

describe('polygonCentroid', () => {
  it('正方形の重心を [緯度, 経度] の順で中心座標として返す', () => {
    const [latitude, longitude] = polygonCentroid(squareGeometry);
    expect(longitude).toBeCloseTo(139.05, 5);
    expect(latitude).toBeCloseTo(35.05, 5);
  });

  it('高度を含む座標があっても重心の算出結果に影響しない', () => {
    const withAltitude: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [139.0, 35.0, 10],
          [139.0, 35.1, 12],
          [139.1, 35.1, 8],
          [139.1, 35.0, 9],
          [139.0, 35.0, 10],
        ],
      ],
    };
    const [latitude, longitude] = polygonCentroid(withAltitude);
    expect(longitude).toBeCloseTo(139.05, 5);
    expect(latitude).toBeCloseTo(35.05, 5);
  });
});
