import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { CollectionConfig } from 'payload';

import { richTextHTMLConverters } from '../lib/rich-text-html-converters';

export const Topics: CollectionConfig = {
  slug: 'topics',
  labels: { singular: 'トピック', plural: 'トピック' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'sort', 'published_at'] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 255, label: 'タイトル' },
    { name: 'body', type: 'richText', label: '本文' },
    lexicalHTMLField({
      htmlFieldName: 'body_html',
      lexicalFieldName: 'body',
      storeInDB: true,
      converters: richTextHTMLConverters,
    }),
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'サムネイル画像',
    },
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
      name: 'attachment',
      type: 'upload',
      relationTo: 'media',
      label: 'PDF 添付',
      admin: { description: 'デジタルパンフ等' },
    },
    { name: 'sort', type: 'number', label: '表示順' },
    {
      name: 'attachments',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: '添付ファイル',
      admin: { description: '複数添付ファイル' },
    },
  ],
};
