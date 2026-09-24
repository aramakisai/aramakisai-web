import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { CollectionConfig } from 'payload';

import { richTextHTMLConverters } from '../lib/rich-text-html-converters';

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: { singular: 'お知らせ', plural: 'お知らせ' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'published_at'] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 255, label: 'タイトル' },
    { name: 'body', type: 'richText', label: '本文' },
    // フロントエンドは HTML 文字列を受け取る契約のため、lexical から HTML を生成して保存する
    lexicalHTMLField({
      htmlFieldName: 'body_html',
      lexicalFieldName: 'body',
      storeInDB: true,
      converters: richTextHTMLConverters,
    }),
    {
      name: 'published_at',
      type: 'date',
      label: '公開日時',
      admin: {
        description: '未設定は非公開',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'attachments',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: '添付ファイル',
      admin: { description: '複数添付ファイル' },
    },
    {
      name: 'meta_description',
      type: 'textarea',
      maxLength: 200,
      label: '説明文 (meta description)',
      admin: { description: '未入力時は本文冒頭から自動生成' },
    },
    {
      name: 'og_image',
      type: 'upload',
      relationTo: 'media',
      label: 'OG 画像',
      admin: { description: '未設定時はサイトの既定画像を使用' },
    },
  ],
};
