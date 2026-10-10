import type { Block } from 'payload';

// プロトコル相対 (//host) と、ブラウザが // と同じに解釈する /\host は外部サイトへ飛ばせてしまうため除く
const SAFE_URL = /^(https?:\/\/|\/(?![/\\]))/;

export const validateButtonUrl = (value: unknown): true | string =>
  typeof value === 'string' && SAFE_URL.test(value)
    ? true
    : 'https:// ・ http:// ・ / のいずれかで始まるリンク先を入力してください';

export const imageRow: Block = {
  slug: 'imageRow',
  labels: { singular: '横並び', plural: '横並び' },
  fields: [
    {
      name: 'items',
      type: 'array',
      label: '画像',
      minRows: 1,
      maxRows: 3,
      required: true,
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true, label: '画像' },
        { name: 'label', type: 'text', maxLength: 30, label: 'ラベル' },
      ],
    },
  ],
};

export const callout: Block = {
  slug: 'callout',
  labels: { singular: '注意枠', plural: '注意枠' },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'caution',
      label: '種類',
      options: [
        { label: '注意', value: 'caution' },
        { label: '補足', value: 'note' },
      ],
    },
    { name: 'text', type: 'textarea', required: true, maxLength: 500, label: '文章' },
  ],
};

export const buttonLink: Block = {
  slug: 'buttonLink',
  labels: { singular: 'ボタン型リンク', plural: 'ボタン型リンク' },
  fields: [
    { name: 'label', type: 'text', required: true, maxLength: 30, label: '文言' },
    { name: 'url', type: 'text', required: true, maxLength: 500, label: 'リンク先', validate: validateButtonUrl },
  ],
};
