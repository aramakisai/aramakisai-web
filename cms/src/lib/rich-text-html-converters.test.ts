import { defaultHTMLConvertersAsync } from '@payloadcms/richtext-lexical/html-async';
import type { SerializedUploadNode } from '@payloadcms/richtext-lexical';
import { describe, expect, it } from 'vitest';

import { richTextHTMLConverters } from './rich-text-html-converters';

const converters = richTextHTMLConverters({ defaultConverters: defaultHTMLConvertersAsync });

const baseArgs = {
  childIndex: 0,
  converters,
  nodesToHTML: async () => [],
  parent: { type: 'root' } as never,
  providedCSSString: '',
  providedStyleTag: '',
};

const uploadNode = (overrides: Partial<SerializedUploadNode>): SerializedUploadNode =>
  ({
    children: [],
    fields: {},
    format: '',
    id: 'upload-1',
    relationTo: 'media',
    type: 'upload',
    value: 1,
    version: 1,
    ...overrides,
  }) as unknown as SerializedUploadNode;

describe('richTextHTMLConverters の画像変換', () => {
  it('画像はメディア ID を data 属性に持たせ src を持たない', async () => {
    const html = await (converters.upload as (args: unknown) => Promise<string>)({
      ...baseArgs,
      node: uploadNode({ value: 42 }),
      populate: async () => ({ id: 42, mimeType: 'image/webp', alt: '会場全景' }),
    });

    expect(html).toBe('<img data-media-id="42" alt="会場全景">');
    expect(html).not.toContain('src=');
  });

  it('代替テキストは lexical 側の指定をメディアの alt より優先する', async () => {
    const html = await (converters.upload as (args: unknown) => Promise<string>)({
      ...baseArgs,
      node: uploadNode({ value: 1, fields: { alt: 'エディタ側の代替テキスト' } }),
      populate: async () => ({ id: 1, mimeType: 'image/png', alt: 'メディア側' }),
    });

    expect(html).toContain('alt="エディタ側の代替テキスト"');
  });

  it('画像以外のアップロードは既定のリンク変換のまま出力する', async () => {
    const html = await (converters.upload as (args: unknown) => Promise<string>)({
      ...baseArgs,
      node: uploadNode({ value: 7 }),
      populate: async () => ({
        id: 7,
        mimeType: 'application/pdf',
        filename: 'guide.pdf',
        url: 'https://example.com/guide.pdf',
      }),
    });

    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com/guide.pdf"');
    expect(html).not.toContain('data-media-id');
  });

  it('populate が解決できない画像は img タグごと出力しない', async () => {
    const html = await (converters.upload as (args: unknown) => Promise<string>)({
      ...baseArgs,
      node: uploadNode({ value: 999 }),
      populate: async () => undefined,
    });

    expect(html).toBe('');
  });

  it('属性値に含まれる特殊文字をエスケープする', async () => {
    const html = await (converters.upload as (args: unknown) => Promise<string>)({
      ...baseArgs,
      node: uploadNode({ value: 5 }),
      populate: async () => ({ id: 5, mimeType: 'image/png', alt: '"<script>"' }),
    });

    expect(html).toBe('<img data-media-id="5" alt="&quot;&lt;script&gt;&quot;">');
  });
});
