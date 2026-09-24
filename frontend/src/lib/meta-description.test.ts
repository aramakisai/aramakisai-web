import { describe, expect, it } from 'vitest';
import {
  META_DESCRIPTION_MAX_LENGTH,
  toMetaDescription,
} from './meta-description';

describe('toMetaDescription', () => {
  it('HTML タグを除去する', () => {
    expect(toMetaDescription(['<p>本文<br>です</p>'], 'fallback')).toBe(
      '本文 です',
    );
  });

  it('実体参照を最小限デコードする', () => {
    expect(
      toMetaDescription(['A&amp;B &lt;tag&gt; &quot;quote&quot;'], 'fallback'),
    ).toBe('A&B <tag> "quote"');
  });

  it('数値文字参照をデコードする', () => {
    expect(toMetaDescription(['&#65;&#x42;'], 'fallback')).toBe('AB');
  });

  it('連続する空白・改行を単一の空白に正規化し前後をトリムする', () => {
    expect(toMetaDescription(['  foo\n\n  bar\t baz  '], 'fallback')).toBe(
      'foo bar baz',
    );
  });

  it('120 文字以内であればそのまま返す', () => {
    const value = 'あ'.repeat(META_DESCRIPTION_MAX_LENGTH);
    expect(toMetaDescription([value], 'fallback')).toBe(value);
  });

  it('120 文字を超える場合は 119 文字 + 省略記号に切り詰める', () => {
    const value = 'あ'.repeat(META_DESCRIPTION_MAX_LENGTH + 1);
    const result = toMetaDescription([value], 'fallback');
    expect(result).toBe(`${'あ'.repeat(META_DESCRIPTION_MAX_LENGTH - 1)}…`);
    expect(result.length).toBe(META_DESCRIPTION_MAX_LENGTH);
  });

  it('先頭から最初の非空候補を採用する', () => {
    expect(
      toMetaDescription([null, undefined, '', '  ', '本命'], 'fallback'),
    ).toBe('本命');
  });

  it('タグのみで実質空になる候補はスキップして次の候補を採用する', () => {
    expect(toMetaDescription(['<div></div>', '実質候補'], 'fallback')).toBe(
      '実質候補',
    );
  });

  it('全ての候補が空なら fallback を返す', () => {
    expect(toMetaDescription([null, undefined, '', '<br>'], 'fallback')).toBe(
      'fallback',
    );
  });

  it('候補配列が空でも fallback を返す', () => {
    expect(toMetaDescription([], 'fallback')).toBe('fallback');
  });
});
