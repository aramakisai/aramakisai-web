import { describe, expect, it } from 'vitest';

import { ParkingLots } from './parking-lots';
import { ParkingStatuses } from './parking-statuses';

type NamedField = { name: string; [key: string]: unknown };

const fieldOf = (c: { fields: unknown[] }, name: string): NamedField =>
  c.fields.find((f) => (f as NamedField).name === name) as NamedField;

describe('ParkingLots', () => {
  it('slug・タイトル・一覧列・既定の並びを持つ', () => {
    expect(ParkingLots.slug).toBe('parking_lots');
    expect(ParkingLots.admin?.useAsTitle).toBe('name');
    expect(ParkingLots.admin?.defaultColumns).toEqual(['name', 'sort']);
    expect(ParkingLots.defaultSort).toBe('sort');
  });

  it('name は必須で最大 255', () => {
    const name = fieldOf(ParkingLots, 'name');
    expect(name.type).toBe('text');
    expect(name.required).toBe(true);
    expect(name.maxLength).toBe(255);
  });

  it('空き状況は持たず、access は登録口に任せる', () => {
    expect(ParkingLots.fields.map((f) => (f as NamedField).name)).toEqual(['name', 'sort']);
    expect(ParkingLots.access).toBeUndefined();
  });
});

describe('ParkingStatuses', () => {
  it('slug・タイトル・一覧列を持つ', () => {
    expect(ParkingStatuses.slug).toBe('parking_statuses');
    expect(ParkingStatuses.admin?.defaultColumns).toEqual(['lot', 'status', 'updatedAt']);
    expect(ParkingStatuses.access).toBeUndefined();
  });

  it('lot は管理画面で読み取り専用、作成後も更新できない', () => {
    const lot = fieldOf(ParkingStatuses, 'lot') as NamedField & {
      admin: { readOnly: boolean };
      access: { create: () => boolean; update: () => boolean };
    };
    expect(lot.type).toBe('relationship');
    expect(lot.relationTo).toBe('parking_lots');
    expect(lot.required).toBe(true);
    expect(lot.unique).toBe(true);
    expect(lot.admin.readOnly).toBe(true);
    expect(lot.access.create()).toBe(false);
    expect(lot.access.update()).toBe(false);
  });

  it('status は 3 択で既定値を持たず、更新時だけ必須', async () => {
    const status = fieldOf(ParkingStatuses, 'status') as NamedField & {
      validate: (v: unknown, o: { operation: string }) => unknown;
    };
    expect(status.type).toBe('select');
    expect(status.required).toBeFalsy();
    expect(status.defaultValue).toBeUndefined();
    expect((status.options as { value: string }[]).map((o) => o.value)).toEqual([
      'available',
      'crowded',
      'full',
    ]);
    expect(await status.validate(null, { operation: 'create' })).toBe(true);
    expect(await status.validate(null, { operation: 'update' })).not.toBe(true);
    expect(await status.validate('full', { operation: 'update' })).toBe(true);
  });
});
