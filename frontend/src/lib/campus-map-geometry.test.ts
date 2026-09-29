import { describe, it, expect } from 'vitest';
import {
  parseAreaGeometry,
  polygonCentroid,
  singlePolygonCentroid,
  multiPolygonGeometrySchema,
  type MultiPolygonGeometry,
} from './campus-map-geometry';

const squarePolygon = {
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

const squareMultiPolygon: MultiPolygonGeometry = {
  type: 'MultiPolygon',
  coordinates: [squarePolygon.coordinates],
};

describe('parseAreaGeometry', () => {
  it('旧形式の Polygon を受け入れ、MultiPolygon へ正規化する', () => {
    const result = parseAreaGeometry(squarePolygon);
    expect(result.kind).toBe('valid');
    if (result.kind === 'valid') {
      expect(result.value).toEqual(squareMultiPolygon);
    }
  });

  it('MultiPolygon をそのまま受け入れる', () => {
    const twoPolygons: MultiPolygonGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        squarePolygon.coordinates,
        [
          [
            [140.0, 36.0],
            [140.0, 36.1],
            [140.1, 36.1],
            [140.1, 36.0],
            [140.0, 36.0],
          ],
        ],
      ],
    };
    const result = parseAreaGeometry(twoPolygons);
    expect(result.kind).toBe('valid');
    if (result.kind === 'valid') {
      expect(result.value).toEqual(twoPolygons);
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
    const result = parseAreaGeometry(withAltitude);
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
    expect(parseAreaGeometry(outOfRange).kind).toBe('invalid');
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
    expect(parseAreaGeometry(unclosed).kind).toBe('invalid');
  });

  it('MultiPolygon でポリゴンが 1 つも無い場合を拒否する', () => {
    expect(
      parseAreaGeometry({ type: 'MultiPolygon', coordinates: [] }).kind,
    ).toBe('invalid');
  });

  it.each([
    null,
    undefined,
    'not a polygon',
    42,
    { type: 'Polygon', coordinates: 'invalid' },
    { type: 'LineString', coordinates: [[139.0, 35.0]] },
  ])('配列でない/不正な値 %p を拒否する', (value) => {
    expect(parseAreaGeometry(value).kind).toBe('invalid');
  });

  it('失敗時に理由 (reason) を保持する', () => {
    const result = parseAreaGeometry(null);
    if (result.kind !== 'invalid') {
      throw new Error('invalid になるはず');
    }
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

describe('multiPolygonGeometrySchema', () => {
  it('独立して export されており、正規化済み MultiPolygon の単体検証に使える', () => {
    expect(
      multiPolygonGeometrySchema.safeParse(squareMultiPolygon).success,
    ).toBe(true);
  });
});

describe('singlePolygonCentroid', () => {
  it('正方形の重心を [緯度, 経度] の順で返す', () => {
    const [latitude, longitude] = singlePolygonCentroid(
      squarePolygon.coordinates,
    );
    expect(longitude).toBeCloseTo(139.05, 5);
    expect(latitude).toBeCloseTo(35.05, 5);
  });

  it('高度を含む座標があっても重心の算出結果に影響しない', () => {
    const withAltitude = [
      [
        [139.0, 35.0, 10],
        [139.0, 35.1, 12],
        [139.1, 35.1, 8],
        [139.1, 35.0, 9],
        [139.0, 35.0, 10],
      ],
    ];
    const [latitude, longitude] = singlePolygonCentroid(withAltitude);
    expect(longitude).toBeCloseTo(139.05, 5);
    expect(latitude).toBeCloseTo(35.05, 5);
  });
});

describe('polygonCentroid', () => {
  it('ポリゴンが 1 つの場合はその重心を返す', () => {
    const [latitude, longitude] = polygonCentroid(squareMultiPolygon);
    expect(longitude).toBeCloseTo(139.05, 5);
    expect(latitude).toBeCloseTo(35.05, 5);
  });

  it('複数ポリゴンの場合は面積が最大のポリゴンの重心を返す', () => {
    // 1 辺 0.1 度の正方形 (小) と 1 辺 1.0 度の正方形 (大) を離れた場所に置く
    const small = squarePolygon.coordinates;
    const large = [
      [
        [10.0, 10.0],
        [10.0, 11.0],
        [11.0, 11.0],
        [11.0, 10.0],
        [10.0, 10.0],
      ],
    ];
    const geometry: MultiPolygonGeometry = {
      type: 'MultiPolygon',
      coordinates: [small, large],
    };

    const [latitude, longitude] = polygonCentroid(geometry);
    expect(longitude).toBeCloseTo(10.5, 5);
    expect(latitude).toBeCloseTo(10.5, 5);
  });
});
