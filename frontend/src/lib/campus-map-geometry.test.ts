import { describe, it, expect } from 'vitest';
import {
  parseAreaGeometry,
  polygonCentroid,
  singlePolygonCentroid,
  multiPolygonGeometrySchema,
  type MultiPolygonGeometry,
  type Position,
  type PolygonCoordinates,
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

  it('原点から遠い (経度139/緯度36) 座標系の小さく複雑な形状でも重心が外環の bbox 内に収まる', () => {
    // 本番の「Bグループ」エリアの 1 ポリゴン目 (実測)。原点補正がないと桁落ちで
    // bbox から大きく外れた点 (キャンパス外) を返していた
    const ring: Position[] = [
      [139.045543, 36.4307083],
      [139.045575, 36.4307011],
      [139.0455622, 36.4306603],
      [139.0455514, 36.4306368],
      [139.0455384, 36.4306058],
      [139.0455207, 36.4305744],
      [139.0454978, 36.4305437],
      [139.0454606, 36.4305181],
      [139.045431, 36.4305045],
      [139.0454133, 36.4305241],
      [139.0454422, 36.4305387],
      [139.0454694, 36.4305593],
      [139.0454929, 36.4305889],
      [139.0455064, 36.4306117],
      [139.0455215, 36.4306433],
      [139.0455302, 36.4306666],
      [139.0455391, 36.4306922],
      [139.045543, 36.4307083],
    ];
    const [latitude, longitude] = singlePolygonCentroid([ring]);

    const longitudes = ring.map(([x]) => x);
    const latitudes = ring.map(([, y]) => y);
    expect(longitude).toBeGreaterThanOrEqual(Math.min(...longitudes));
    expect(longitude).toBeLessThanOrEqual(Math.max(...longitudes));
    expect(latitude).toBeGreaterThanOrEqual(Math.min(...latitudes));
    expect(latitude).toBeLessThanOrEqual(Math.max(...latitudes));
  });
});

describe('singlePolygonCentroid (本番 Bグループの実座標)', () => {
  // 本番 CMS map_areas id=7 の 4 ポリゴン (細長い帯・湾曲) のうち湾曲した 13 頂点のもの
  const CURVED: PolygonCoordinates = [
    [
      [139.045464, 36.4309618],
      [139.0454962, 36.4309452],
      [139.0455255, 36.4309216],
      [139.0455488, 36.4308926],
      [139.0455699, 36.4308525],
      [139.0455823, 36.4308206],
      [139.0456079, 36.4308281],
      [139.0455985, 36.4308607],
      [139.0455738, 36.4309012],
      [139.0455474, 36.4309354],
      [139.045512, 36.4309637],
      [139.0454806, 36.4309796],
      [139.045464, 36.4309618],
    ],
  ];

  it('湾曲した帯でも重心が外環の内側に入る', () => {
    const [latitude, longitude] = singlePolygonCentroid(CURVED);
    expect(pointInRing([longitude, latitude], CURVED[0])).toBe(true);
  });
});

function pointInRing(
  [x, y]: readonly [number, number],
  ring: readonly (readonly number[])[],
): boolean {
  let inside = false;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    if (y0 > y !== y1 > y && x < ((x1 - x0) * (y - y0)) / (y1 - y0) + x0) {
      inside = !inside;
    }
  }
  return inside;
}
