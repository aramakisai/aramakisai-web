import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { CollectionConfig } from 'payload';

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
  },
  defaultSort: 'sort',
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      maxLength: 100,
      admin: { description: 'ページ識別子 (URLパス相当, UNIQUE)' },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 255,
      admin: { description: 'ページ見出し(h1)および<title>タグに使用' },
    },
    {
      name: 'content',
      type: 'richText',
      admin: { description: '本文' },
    },
    lexicalHTMLField({
      htmlFieldName: 'content_html',
      lexicalFieldName: 'content',
      storeInDB: true,
    }),
    {
      name: 'embed_url',
      type: 'text',
      maxLength: 500,
      admin: { description: '埋め込みURL (地図・フォーム等のiframe embed)' },
    },
    {
      name: 'embed_height',
      type: 'number',
      admin: { description: 'embed_urlのiframe高さ(px)。未指定時は16:9のデフォルト比率' },
    },
    {
      name: 'sort',
      type: 'number',
      admin: { description: '表示順' },
    },
  ],
};
