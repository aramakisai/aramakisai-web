import { describe, expect, it } from 'vitest';

import { Sponsors } from './sponsors';

type NamedField = { name: string; [key: string]: unknown };

const fieldOf = (fields: readonly unknown[], name: string): NamedField =>
  fields.find((f): f is NamedField => (f as NamedField).name === name) as NamedField;

const type = fieldOf(Sponsors.fields, 'type');
const tier = fieldOf(Sponsors.fields, 'tier');
const businessCategory = fieldOf(Sponsors.fields, 'business_category');
const address = fieldOf(Sponsors.fields, 'address');
const vendor = fieldOf(Sponsors.fields, 'vendor');
const vendorFields = vendor.fields as NamedField[];
const boothNumber = fieldOf(vendorFields, 'booth_number');
const localLatitude = fieldOf(Sponsors.fields, 'local_latitude');
const localLongitude = fieldOf(Sponsors.fields, 'local_longitude');
const localImage = fieldOf(Sponsors.fields, 'local_image');
const localPhone = fieldOf(Sponsors.fields, 'local_phone');

describe('type フィールド', () => {
  it('4 択の複数選択かつ必須で、既定値を持たない', () => {
    expect(type.type).toBe('select');
    expect(type.hasMany).toBe(true);
    expect(type.required).toBe(true);
    expect(type.defaultValue).toBeUndefined();
    expect((type.options as { value: string }[]).map((o) => o.value)).toEqual([
      'ad',
      'local',
      'vendor',
      'other',
    ]);
  });
});

const conditionOf = (field: NamedField) =>
  (field.admin as { condition: (data: Record<string, unknown>) => boolean }).condition;

describe('種別ごとの入力項目の出し分け', () => {
  it('協賛プランは広告協賛を選んだときだけ表示する', () => {
    const condition = conditionOf(tier);
    expect(condition({ type: ['ad'] })).toBe(true);
    expect(condition({ type: ['ad', 'local'] })).toBe(true);
    expect(condition({ type: ['local'] })).toBe(false);
    expect(condition({})).toBe(false);
  });

  it('業種タグと住所は地域協賛を選んだときだけ表示する', () => {
    expect(conditionOf(businessCategory)({ type: ['local'] })).toBe(true);
    expect(conditionOf(businessCategory)({ type: ['ad'] })).toBe(false);
    expect(conditionOf(address)({ type: ['local'] })).toBe(true);
    expect(conditionOf(address)({ type: ['vendor'] })).toBe(false);
  });

  it('出店の企画内容グループは出店協賛を選んだときだけ表示する', () => {
    expect(vendor.type).toBe('group');
    expect(conditionOf(vendor)({ type: ['vendor'] })).toBe(true);
    expect(conditionOf(vendor)({ type: ['ad', 'vendor'] })).toBe(true);
    expect(conditionOf(vendor)({ type: ['other'] })).toBe(false);
    expect(conditionOf(vendor)({})).toBe(false);
  });

  it('出店グループは企画名・紹介文・画像と配置の項目を持ち、メニューは持たない', () => {
    expect(vendorFields.map((f) => f.name)).toEqual([
      'name',
      'description',
      'images',
      'open_days',
      'area_id',
      'booth_number',
      'booth_label',
    ]);
  });
});

describe('booth_number フィールド', () => {
  it('最大 20 文字のテキストで、空白のみの値は null で保存する', () => {
    expect(boothNumber.type).toBe('text');
    expect(boothNumber.maxLength).toBe(20);
    const [hook] = (boothNumber.hooks as { beforeValidate: ((a: { value: unknown }) => unknown)[] })
      .beforeValidate;
    expect(hook({ value: ' ' })).toBeNull();
    expect(hook({ value: 'GB155' })).toBe('GB155');
  });
});

describe('地域協賛マップ項目', () => {
  it('業種タグは単一選択で、6カテゴリのlabelとvalueの組を持つ', () => {
    expect(businessCategory.type).toBe('select');
    expect(businessCategory.hasMany).not.toBe(true);
    expect(businessCategory.options).toEqual([
      { label: '病院', value: 'hospital' },
      { label: '生活', value: 'life' },
      { label: '車', value: 'car' },
      { label: '教育', value: 'education' },
      { label: '飲食', value: 'food' },
      { label: 'ショップ', value: 'shop' },
    ]);
  });

  it('地図固有項目はlocalのときだけ表示する', () => {
    for (const field of [businessCategory, localLatitude, localLongitude, localImage, localPhone]) {
      const condition = conditionOf(field);
      expect(condition({ type: ['local'] })).toBe(true);
      expect(condition({ type: ['ad'] })).toBe(false);
    }
  });

  it('name と type 以外の既存項目を必須化しない', () => {
    const others = (Sponsors.fields as NamedField[]).filter(
      (f) => f.name !== 'name' && f.name !== 'type',
    );
    expect(others.length).toBeGreaterThan(10);
    for (const field of others) expect(field.required).not.toBe(true);
  });
});
