import { describe, expect, it } from 'vitest';

import { buttonLink, callout, imageRow, validateButtonUrl } from './rich-text-blocks';

type F = { name: string; maxLength?: number; minRows?: number; maxRows?: number; required?: boolean; defaultValue?: unknown; fields?: F[] };
const f = (b: { fields: unknown[] }, name: string) => b.fields.find((x) => (x as F).name === name) as F;

describe('validateButtonUrl', () => {
  it.each(['https://example.com', 'http://example.com/a', '/exhibitions'])('%s を受け付ける', (url) => {
    expect(validateButtonUrl(url)).toBe(true);
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', '//evil.example', '/\\evil.example', 'example.com', 'mailto:a@b.c', ''])(
    '%j を拒否する',
    (url) => {
      expect(typeof validateButtonUrl(url)).toBe('string');
    },
  );

  it('空でない非文字列も拒否する', () => {
    expect(typeof validateButtonUrl(undefined)).toBe('string');
  });
});

describe('本文ブロック定義', () => {
  it('slug', () => {
    expect([imageRow.slug, callout.slug, buttonLink.slug]).toEqual(['imageRow', 'callout', 'buttonLink']);
  });

  it('横並びは1〜3件で画像必須・ラベル30字まで', () => {
    const items = f(imageRow, 'items');
    expect([items.minRows, items.maxRows]).toEqual([1, 3]);
    expect(f(items as never, 'image').required).toBe(true);
    expect(f(items as never, 'label').maxLength).toBe(30);
  });

  it('注意枠の種類は既定が注意、文章は500字まで', () => {
    expect(f(callout, 'kind').defaultValue).toBe('caution');
    expect(f(callout, 'text').maxLength).toBe(500);
  });

  it('ボタン型リンクは文言30字・リンク先500字まで', () => {
    expect(f(buttonLink, 'label').maxLength).toBe(30);
    expect(f(buttonLink, 'url').maxLength).toBe(500);
  });
});
