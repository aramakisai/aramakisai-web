import { describe, expect, it } from 'vitest';

import { MapAreas } from './map-areas';

type NamedField = { name: string; [key: string]: unknown };

const fieldOf = (fields: readonly unknown[], name: string): NamedField =>
  fields.find((f): f is NamedField => (f as NamedField).name === name) as NamedField;

const color = fieldOf(MapAreas.fields, 'color');
const geometry = fieldOf(MapAreas.fields, 'geometry');

const validateGeometry = (value: unknown) =>
  (geometry.validate as (v: unknown, o: unknown) => true | string)(value, {});

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

describe('color フィールド', () => {
  it('デザイントークン名に限定した選択式で、必須にしない', () => {
    expect(color.type).toBe('select');
    expect(color.required).toBeFalsy();
    expect((color.options as { value: string }[]).map((o) => o.value)).toEqual([
      'primary',
      'secondary',
      'accent',
      'accent-alt',
      'info',
      'success',
      'warning',
    ]);
  });
});

describe('geometry フィールドの保存時検証', () => {
  it('正当な GeoJSON Polygon を受け入れる', () => {
    expect(validateGeometry(squarePolygon)).toBe(true);
  });

  it('高度付き座標を受け入れる', () => {
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
    expect(validateGeometry(withAltitude)).toBe(true);
  });

  it.each([
    null,
    undefined,
    'not a polygon',
    42,
    { type: 'Point', coordinates: [139.0, 35.0] },
    { type: 'Polygon', coordinates: 'invalid' },
    { type: 'Polygon', coordinates: [[[139.0, 35.0], [139.0, 35.1], [139.1, 35.0]]] },
    {
      type: 'Polygon',
      coordinates: [
        [
          [139.0, 35.0],
          [139.0, 35.1],
          [139.1, 35.1],
          [139.1, 35.0],
        ],
      ],
    },
    { type: 'Polygon', coordinates: [[[200, 35.0], [139.0, 35.1], [139.1, 35.1], [200, 35.0]]] },
  ])('不正な geometry %j を理由付きで拒否する', (value) => {
    expect(typeof validateGeometry(value)).toBe('string');
  });
});
