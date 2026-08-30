import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { CollectionConfig } from 'payload';

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'published_at'] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 255 },
    { name: 'body', type: 'richText' },
    // フロントエンドは HTML 文字列を受け取る契約のため、lexical から HTML を生成して保存する
    lexicalHTMLField({
      htmlFieldName: 'body_html',
      lexicalFieldName: 'body',
      storeInDB: true,
    }),
    {
      name: 'published_at',
      type: 'date',
      admin: {
        description: '公開日時 (未設定は非公開)',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'attachments',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: { description: '複数添付ファイル' },
    },
  ],
};
