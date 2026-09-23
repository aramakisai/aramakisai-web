import { describe, expect, it } from 'vitest';

import { Sponsors } from './sponsors';

type NamedField = { name: string; [key: string]: unknown };

const fieldOf = (fields: readonly unknown[], name: string): NamedField =>
  fields.find((f): f is NamedField => (f as NamedField).name === name) as NamedField;

const type = fieldOf(Sponsors.fields, 'type');
const tier = fieldOf(Sponsors.fields, 'tier');
const businessCategory = fieldOf(Sponsors.fields, 'business_category');
const address = fieldOf(Sponsors.fields, 'address');
const areaId = fieldOf(Sponsors.fields, 'area_id');
const boothNumber = fieldOf(Sponsors.fields, 'booth_number');
const boothLabel = fieldOf(Sponsors.fields, 'booth_label');

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

describe('種別ごとの入力項目の出し分け', () => {
  const conditionOf = (field: NamedField) =>
    (field.admin as { condition: (data: Record<string, unknown>) => boolean }).condition;

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

  it('マップ配置エリア・ブース番号・マップ表示ラベルは出店協賛を選んだときだけ表示する', () => {
    expect(conditionOf(areaId)({ type: ['vendor'] })).toBe(true);
    expect(conditionOf(areaId)({ type: ['other'] })).toBe(false);
    expect(conditionOf(boothNumber)({ type: ['vendor'] })).toBe(true);
    expect(conditionOf(boothLabel)({ type: ['vendor'] })).toBe(true);
    expect(conditionOf(boothLabel)({ type: ['ad'] })).toBe(false);
  });
});
