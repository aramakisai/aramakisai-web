import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { CollectionConfig } from 'payload';

export const Topics: CollectionConfig = {
  slug: 'topics',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'sort', 'published_at'] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 255 },
    { name: 'body', type: 'richText' },
    lexicalHTMLField({
      htmlFieldName: 'body_html',
      lexicalFieldName: 'body',
      storeInDB: true,
    }),
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'サムネイル画像' },
    },
    {
      name: 'published_at',
      type: 'date',
      admin: {
        description: '公開日時 (未設定は非公開)',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'attachment',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'PDF 添付 (デジタルパンフ等)' },
    },
    { name: 'sort', type: 'number', admin: { description: '表示順' } },
    {
      name: 'attachments',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: { description: '複数添付ファイル' },
    },
  ],
};
