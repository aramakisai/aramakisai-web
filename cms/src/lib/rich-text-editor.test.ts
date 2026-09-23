import { defaultEditorFeatures } from '@payloadcms/richtext-lexical';
import { describe, expect, it } from 'vitest';

import { richTextEditorFeatures } from './rich-text-editor';

describe('richTextEditorFeatures', () => {
  const resolved = richTextEditorFeatures({ defaultFeatures: defaultEditorFeatures });
  const keys = resolved.map((feature) => feature.key);

  it('見出し・段落・強調・リンク・リスト・引用・画像・水平線・インラインツールバーを残す', () => {
    expect(keys.sort()).toEqual(
      [
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'paragraph',
        'heading',
        'unorderedList',
        'orderedList',
        'link',
        'blockquote',
        'upload',
        'horizontalRule',
        'toolbarInline',
      ].sort(),
    );
  });

  it('サブスクリプト・上付き・インラインコード・チェックリスト・関連・整列・インデントを除く', () => {
    for (const key of [
      'subscript',
      'superscript',
      'inlineCode',
      'checklist',
      'relationship',
      'align',
      'indent',
    ]) {
      expect(keys).not.toContain(key);
    }
  });

  it('見出しを h2〜h4 に限定する', () => {
    const heading = resolved.find((feature) => feature.key === 'heading');
    const props = heading?.serverFeatureProps as unknown as { enabledHeadingSizes?: string[] } | undefined;
    expect(props?.enabledHeadingSizes).toEqual(['h2', 'h3', 'h4']);
  });
});
