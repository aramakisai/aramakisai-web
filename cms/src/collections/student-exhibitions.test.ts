import { describe, expect, it } from 'vitest';

import { StudentExhibitions } from './student-exhibitions';

type NamedField = { name: string; [key: string]: unknown };

const fieldOf = (fields: readonly unknown[], name: string): NamedField =>
  fields.find((f): f is NamedField => (f as NamedField).name === name) as NamedField;

const links = fieldOf(StudentExhibitions.fields, 'links');
const linkFields = links.fields as readonly unknown[];
const url = fieldOf(linkFields, 'url');
const platform = fieldOf(linkFields, 'platform');
const categories = fieldOf(StudentExhibitions.fields, 'categories');
const stageGroup = fieldOf(StudentExhibitions.fields, 'stage');

const validateUrl = (value: unknown) =>
  (url.validate as (v: unknown, o: unknown) => true | string)(value, {});

describe('links フィールド', () => {
  it('行の追加・削除・並べ替えができる array として定義される', () => {
    expect(links.type).toBe('array');
  });

  it('サービス種別と URL を 1 組とする', () => {
    expect(platform.type).toBe('select');
    expect(platform.required).toBe(true);
    expect(url.type).toBe('text');
    expect(url.required).toBe(true);
  });

  it('サービス種別の選択肢は 7 種', () => {
    expect((platform.options as { value: string }[]).map((o) => o.value)).toEqual([
      'x',
      'instagram',
      'facebook',
      'youtube',
      'tiktok',
      'line',
      'website',
    ]);
  });

  it('https:// で始まる URL を受け入れる', () => {
    expect(validateUrl('https://example.com/path?a=1')).toBe(true);
  });

  it.each(['http://example.com', 'example.com', 'ftp://example.com', 'https://'])(
    '%s を理由付きで拒否する',
    (value) => {
      expect(typeof validateUrl(value)).toBe('string');
    },
  );

  it('空の URL を拒否する', () => {
    expect(typeof validateUrl(undefined)).toBe('string');
    expect(typeof validateUrl('')).toBe('string');
  });
});

describe('categories フィールド', () => {
  it('4 択の複数選択かつ 1 つ以上必須', () => {
    expect(categories.type).toBe('select');
    expect(categories.hasMany).toBe(true);
    expect(categories.required).toBe(true);
    expect((categories.options as { value: string }[]).map((o) => o.value)).toEqual([
      'stage',
      'exhibit',
      'vendor',
      'other',
    ]);
  });
});

describe('カテゴリ別企画内容欄 (stage グループを例に検証)', () => {
  const stageFields = stageGroup.fields as readonly unknown[];

  it('企画名 (任意・最大 255 文字) と紹介文と画像を持つ', () => {
    const name = fieldOf(stageFields, 'name');
    const description = fieldOf(stageFields, 'description');
    const images = fieldOf(stageFields, 'images');
    expect(stageGroup.type).toBe('group');
    expect(name.type).toBe('text');
    expect(name.required).toBeFalsy();
    expect(name.maxLength).toBe(255);
    expect(description.type).toBe('textarea');
    expect(images.type).toBe('upload');
    expect(images.hasMany).toBe(true);
  });

  it('カテゴリにステージを含むときだけ表示する', () => {
    const condition = (stageGroup.admin as { condition: (data: unknown) => boolean }).condition;
    expect(condition({ categories: ['stage'] })).toBe(true);
    expect(condition({ categories: ['exhibit', 'stage'] })).toBe(true);
    expect(condition({ categories: ['exhibit'] })).toBe(false);
    expect(condition({})).toBe(false);
  });

  it('一括編集の対象から除外する (admin.condition は複数レコード分の categories を評価できないため)', () => {
    expect((stageGroup.admin as { disableBulkEdit?: boolean }).disableBulkEdit).toBe(true);
  });
});
