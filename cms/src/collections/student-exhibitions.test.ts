import { describe, expect, it } from 'vitest';

import { StudentExhibitions } from './student-exhibitions';

type NamedField = { name: string; [key: string]: unknown };

const fieldOf = (fields: readonly unknown[], name: string): NamedField =>
  fields.find((f): f is NamedField => (f as NamedField).name === name) as NamedField;

const links = fieldOf(StudentExhibitions.fields, 'links');
const linkFields = links.fields as readonly unknown[];
const url = fieldOf(linkFields, 'url');
const platform = fieldOf(linkFields, 'platform');
const stageName = fieldOf(StudentExhibitions.fields, 'stage_name');

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

describe('stage_name フィールド', () => {
  it('任意・最大 255 文字のテキスト', () => {
    expect(stageName.type).toBe('text');
    expect(stageName.required).toBeFalsy();
    expect(stageName.maxLength).toBe(255);
  });

  it('カテゴリにステージを含むときだけ表示する', () => {
    const condition = (stageName.admin as { condition: (data: unknown) => boolean }).condition;
    expect(condition({ category: ['stage'] })).toBe(true);
    expect(condition({ category: ['exhibit', 'stage'] })).toBe(true);
    expect(condition({ category: ['exhibit'] })).toBe(false);
    expect(condition({})).toBe(false);
  });
});

describe('description フィールド', () => {
  it('企画の紹介文として案内する', () => {
    const description = fieldOf(StudentExhibitions.fields, 'description');
    expect((description.admin as { description: string }).description).toContain('紹介文');
  });
});
