import { describe, expect, it } from 'vitest';

import { MapAreas } from './map-areas';

type NamedField = { name: string; [key: string]: unknown };

const fieldOf = (fields: readonly unknown[], name: string): NamedField =>
  fields.find((f): f is NamedField => (f as NamedField).name === name) as NamedField;

const color = fieldOf(MapAreas.fields, 'color');
const geometry = fieldOf(MapAreas.fields, 'geometry');

type HookArgs = { value: unknown };

const normalize = (value: unknown) => {
  const hooks = geometry.hooks as { beforeChange: ((args: HookArgs) => unknown)[] };
  return hooks.beforeChange[0]({ value });
};

const validateGeometry = (value: unknown) =>
  (geometry.validate as (v: unknown, o: unknown) => true | string)(value, {});

const validateColor = (value: unknown) =>
  (color.validate as (v: unknown, o: unknown) => true | string)(value, {});

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

const squareMultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [squarePolygon.coordinates],
};

const otherSquare = [
  [
    [140.0, 36.0],
    [140.0, 36.1],
    [140.1, 36.1],
    [140.1, 36.0],
    [140.0, 36.0],
  ],
];

describe('color フィールド', () => {
  it('Hex 文字列を格納する text フィールドで、必須にしない', () => {
    expect(color.type).toBe('text');
    expect(color.required).toBeFalsy();
  });

  it('#rrggbb 形式を受け入れる', () => {
    expect(validateColor('#7fc8ad')).toBe(true);
    expect(validateColor('#EBB03C')).toBe(true);
  });

  it('未設定を受け入れる', () => {
    expect(validateColor(undefined)).toBe(true);
    expect(validateColor(null)).toBe(true);
    expect(validateColor('')).toBe(true);
  });

  it.each(['red', '#fff', '#gggggg', '7fc8ad', '#7fc8ad0'])(
    '不正な色 %s を理由付きで拒否する',
    (value) => {
      expect(typeof validateColor(value)).toBe('string');
    },
  );

  it('保存時に小文字へ正規化する', () => {
    const hooks = color.hooks as { beforeChange: ((args: HookArgs) => unknown)[] };
    expect(hooks.beforeChange[0]({ value: '#EBB03C' })).toBe('#ebb03c');
  });
});

describe('geometry フィールドの正規化 (保存前に MultiPolygon 化)', () => {
  it('Polygon を単一ポリゴンの MultiPolygon に包む', () => {
    expect(normalize(squarePolygon)).toEqual(squareMultiPolygon);
  });

  it('MultiPolygon はそのまま MultiPolygon として扱う', () => {
    const twoPolygons = {
      type: 'MultiPolygon',
      coordinates: [squarePolygon.coordinates, otherSquare],
    };
    expect(normalize(twoPolygons)).toEqual(twoPolygons);
  });

  it('geometry が Polygon の Feature を MultiPolygon に変換する', () => {
    const feature = { type: 'Feature', properties: {}, geometry: squarePolygon };
    expect(normalize(feature)).toEqual(squareMultiPolygon);
  });

  it('geometry が MultiPolygon の Feature を MultiPolygon に変換する', () => {
    const feature = { type: 'Feature', properties: {}, geometry: squareMultiPolygon };
    expect(normalize(feature)).toEqual(squareMultiPolygon);
  });

  it('全 feature が Polygon/MultiPolygon の FeatureCollection を1つの MultiPolygon にまとめる', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: squarePolygon },
        { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [otherSquare] } },
      ],
    };
    expect(normalize(collection)).toEqual({
      type: 'MultiPolygon',
      coordinates: [squarePolygon.coordinates, otherSquare],
    });
  });

  it('Point など Polygon/MultiPolygon 以外を含む FeatureCollection は正規化せず素通しする', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [139.0, 35.0] } }],
    };
    expect(normalize(collection)).toEqual(collection);
  });

  it('不正な入力は正規化できず、そのまま返して validate に委ねる', () => {
    expect(normalize('not a geometry')).toBe('not a geometry');
    expect(normalize(null)).toBe(null);
  });
});

describe('geometry フィールドの保存時検証 (正規化後の MultiPolygon を検証)', () => {
  it('正当な MultiPolygon を受け入れる', () => {
    expect(validateGeometry(squareMultiPolygon)).toBe(true);
  });

  it('複数ポリゴンを受け入れる', () => {
    expect(
      validateGeometry({ type: 'MultiPolygon', coordinates: [squarePolygon.coordinates, otherSquare] }),
    ).toBe(true);
  });

  it('高度付き座標を受け入れる', () => {
    const withAltitude = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.0, 35.0, 10],
            [139.0, 35.1, 12],
            [139.1, 35.1, 8],
            [139.1, 35.0, 9],
            [139.0, 35.0, 10],
          ],
        ],
      ],
    };
    expect(validateGeometry(withAltitude)).toBe(true);
  });

  it.each([
    null,
    undefined,
    'not a polygon',
    42,
    squarePolygon, // 正規化前の Polygon はそのまま validate に渡ると拒否される
    { type: 'MultiPolygon', coordinates: 'invalid' },
    { type: 'MultiPolygon', coordinates: [] },
    { type: 'MultiPolygon', coordinates: [[[[139.0, 35.0], [139.0, 35.1], [139.1, 35.0]]]] },
    {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.0, 35.0],
            [139.0, 35.1],
            [139.1, 35.1],
            [139.1, 35.0],
          ],
        ],
      ],
    },
    { type: 'MultiPolygon', coordinates: [[[[200, 35.0], [139.0, 35.1], [139.1, 35.1], [200, 35.0]]]] },
  ])('不正な geometry %j を理由付きで拒否する', (value) => {
    expect(typeof validateGeometry(value)).toBe('string');
  });
});
