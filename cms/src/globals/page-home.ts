import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { GlobalConfig } from 'payload';

export const PageHome: GlobalConfig = {
  slug: 'page_home',
  fields: [
    {
      name: 'hero_message',
      type: 'richText',
      admin: { description: '開催前トップメッセージ' },
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
      admin: { description: '複数ヒーロー画像' },
    },
  ],
};
