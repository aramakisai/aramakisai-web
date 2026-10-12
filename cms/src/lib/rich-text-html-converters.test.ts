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

type Conv = (args: unknown) => Promise<string>;
const block = (blockType: string, fields: Record<string, unknown>) => ({
  type: 'block',
  version: 2,
  fields: { id: 'b1', blockType, ...fields },
});
const run = (node: unknown, populate?: unknown) =>
  (converters.blocks as Record<string, Conv>)[(node as { fields: { blockType: string } }).fields.blockType]({
    ...baseArgs,
    node,
    populate,
  });

describe('richTextHTMLConverters の本文ブロック', () => {
  it('横並びはメディア ID とラベルだけを出し、ラベル空なら figcaption を出さない', async () => {
    const html = await run(
      block('imageRow', {
        items: [
          { image: 1, label: 'A <b>' },
          { image: { id: 2, mimeType: 'image/png' }, label: '' },
        ],
      }),
      async ({ id }: { id: number }) => ({ id, mimeType: 'image/webp' }),
    );
    expect(html).toBe(
      '<div class="rt-image-row" data-count="2">' +
        '<figure><figcaption>A &lt;b&gt;</figcaption><img data-media-id="1" alt="A &lt;b&gt;"></figure>' +
        '<figure><img data-media-id="2" alt=""></figure></div>',
    );
  });

  it('横並びは画像以外・ID 不明の項目を出さず、全項目が無ければ何も出さない', async () => {
    const html = await run(
      block('imageRow', {
        items: [
          { image: 5, label: 'pdf' },
          { image: 6, label: '不明' },
          { image: { id: 7, mimeType: 'image/png' }, label: 'ok' },
        ],
      }),
      async ({ id }: { id: number }) => (id === 5 ? { id, mimeType: 'application/pdf' } : undefined),
    );
    expect(html).toContain('data-count="1"');
    expect(html).not.toContain('pdf');
    expect(html).not.toContain('不明');
    expect(await run(block('imageRow', { items: [{ image: 6, label: 'x' }] }), async () => undefined)).toBe('');
  });

  it('注意枠は種類と改行付きの文章を出し、エスケープする', async () => {
    expect(await run(block('callout', { kind: 'note', text: '1行目<script>\n2行目' }))).toBe(
      '<aside class="rt-callout" data-kind="note"><p>1行目&lt;script&gt;<br>2行目</p></aside>',
    );
  });

  it('注意枠の不明な種類は caution に倒す', async () => {
    expect(await run(block('callout', { kind: 'x"', text: 't' }))).toContain('data-kind="caution"');
  });

  it('ボタン型リンクは文言とリンク先をエスケープする', async () => {
    expect(await run(block('buttonLink', { label: '参加<する>', url: '/a?x=1&y="2"' }))).toBe(
      '<p class="rt-button"><a href="/a?x=1&amp;y=&quot;2&quot;">参加&lt;する&gt;</a></p>',
    );
  });

  it('ボタン型リンクは許可外スキームのリンク先を出さない', async () => {
    expect(await run(block('buttonLink', { label: 'x', url: 'javascript:alert(1)' }))).toBe('');
  });
});

describe('richTextHTMLConverters の表', () => {
  const text = (t: string) => ({ type: 'text', text: t, format: 0, version: 1 });
  const cell = (t: string, extra: Record<string, unknown> = {}) => ({
    type: 'tablecell',
    headerState: 0,
    colSpan: 1,
    rowSpan: 1,
    backgroundColor: '#ff0000',
    children: [{ type: 'paragraph', children: [text(t)], version: 1 }],
    version: 1,
    ...extra,
  });
  const nodesToHTML = async ({ nodes }: { nodes: { type: string }[] }) =>
    Promise.all(
      nodes.map((n) =>
        (converters[n.type] as Conv)({ ...baseArgs, node: n, nodesToHTML, providedStyleTag: '', providedCSSString: '' }),
      ),
    );
  const table = (rows: unknown[]) => ({ type: 'table', children: rows, version: 1 });
  const render = (node: unknown) => (converters.table as Conv)({ ...baseArgs, node, nodesToHTML });

  it('rt-table 構造で出し、インライン style と class を出さない', async () => {
    const html = await render(
      table([{ type: 'tablerow', children: [cell('見出し', { headerState: 1 }), cell('値')], version: 1 }]),
    );
    expect(html).toContain('<div class="rt-table"><table><tbody>');
    expect(html).toMatch(/<tr><th>[\s\S]*見出し[\s\S]*<\/th><td>[\s\S]*値[\s\S]*<\/td><\/tr>/);
    expect(html).not.toContain('style');
    expect(html).not.toContain('lexical-table');
  });

  it('colspan/rowspan は2以上のときだけ出す', async () => {
    const html = await render(
      table([{ type: 'tablerow', children: [cell('a', { colSpan: 2, rowSpan: 3 }), cell('b')], version: 1 }]),
    );
    expect(html).toContain('<td colspan="2" rowspan="3">');
    expect(html.match(/colspan/g)).toHaveLength(1);
    expect(html.match(/rowspan/g)).toHaveLength(1);
  });
});
