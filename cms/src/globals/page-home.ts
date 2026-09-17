import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { GlobalConfig } from 'payload';

export const PageHome: GlobalConfig = {
  slug: 'page_home',
  label: 'トップページ',
  fields: [
    {
      name: 'hero_message',
      type: 'richText',
      label: 'トップメッセージ',
      admin: { description: '開催前に表示' },
    },
    lexicalHTMLField({
      htmlFieldName: 'hero_message_html',
      lexicalFieldName: 'hero_message',
      storeInDB: true,
    }),
    {
      name: 'hero_images',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: 'ヒーロー画像',
      admin: { description: '複数枚設定可' },
    },
  ],
};
