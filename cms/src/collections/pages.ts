import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { CollectionConfig } from 'payload';

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: '固定ページ', plural: '固定ページ' },
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
      label: 'ページ識別子',
      admin: { description: 'URLパス相当 (UNIQUE)' },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 255,
      label: '見出し',
      admin: { description: 'ページ見出し(h1)および<title>タグに使用' },
    },
    {
      name: 'content',
      type: 'richText',
      label: '本文',
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
      label: '埋め込みURL',
      admin: { description: '地図・フォーム等のiframe embed' },
    },
    {
      name: 'embed_height',
      type: 'number',
      label: '埋め込み高さ',
      admin: { description: 'embed_urlのiframe高さ(px)。未指定時は16:9のデフォルト比率' },
    },
    {
      name: 'sort',
      type: 'number',
      label: '表示順',
    },
  ],
};
