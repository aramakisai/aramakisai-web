import { describe, expect, it } from 'vitest';

import { ParkingLots } from './parking-lots';

type NamedField = { name: string; [key: string]: unknown };

const fieldOf = (name: string): NamedField =>
  ParkingLots.fields.find((f) => (f as NamedField).name === name) as NamedField;

describe('ParkingLots', () => {
  it('slug・タイトル・一覧列・既定の並びを持つ', () => {
    expect(ParkingLots.slug).toBe('parking_lots');
    expect(ParkingLots.admin?.useAsTitle).toBe('name');
    expect(ParkingLots.admin?.defaultColumns).toEqual(['name', 'status', 'updatedAt']);
    expect(ParkingLots.defaultSort).toBe('sort');
  });

  it('name は必須で最大 255', () => {
    const name = fieldOf('name');
    expect(name.type).toBe('text');
    expect(name.required).toBe(true);
    expect(name.maxLength).toBe(255);
  });

  it('status は必須の 3 択で既定値を持たない', () => {
    const status = fieldOf('status');
    expect(status.type).toBe('select');
    expect(status.required).toBe(true);
    expect(status.defaultValue).toBeUndefined();
    expect((status.options as { value: string }[]).map((o) => o.value)).toEqual([
      'available',
      'crowded',
      'full',
    ]);
  });

  it('台数・最終更新時刻の専用フィールドを持たない', () => {
    expect(ParkingLots.fields.map((f) => (f as NamedField).name)).toEqual(['name', 'status', 'sort']);
    expect(ParkingLots.access).toBeUndefined();
  });
});
