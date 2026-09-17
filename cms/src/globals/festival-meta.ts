import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { GlobalConfig } from 'payload';

export const FestivalMeta: GlobalConfig = {
  slug: 'festival_meta',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      admin: { description: '祭名' },
    },
    {
      name: 'event_days',
      type: 'json',
      admin: { description: '日ごと開催時間 [{label, open, close}]' },
    },
    {
      name: 'parking_map',
      type: 'upload',
      relationTo: 'media',
      admin: { description: '駐車場マップ画像' },
    },
    {
      name: 'sns_links',
      type: 'json',
      admin: { description: 'SNSリンク一覧' },
    },
    {
      name: 'overview',
      type: 'richText',
      admin: { description: '祭概要 (WYSIWYG)' },
    },
    lexicalHTMLField({
      htmlFieldName: 'overview_html',
      lexicalFieldName: 'overview',
      storeInDB: true,
    }),
    {
      name: 'hero_image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Aboutページ用ヒーロー画像' },
    },
    {
      name: 'theme_word',
      type: 'text',
      maxLength: 255,
      admin: { description: 'テーマ語 (例: 万彩)' },
    },
    {
      name: 'theme_description',
      type: 'richText',
      admin: { description: 'テーマの説明文 (WYSIWYG)' },
    },
    lexicalHTMLField({
      htmlFieldName: 'theme_description_html',
      lexicalFieldName: 'theme_description',
      storeInDB: true,
    }),
    {
      name: 'venue_name',
      type: 'text',
      maxLength: 255,
      admin: { description: '会場名' },
    },
    {
      name: 'campus_map_url',
      type: 'text',
      maxLength: 255,
      admin: { description: 'Google Maps 埋め込み URL' },
    },
    {
      name: 'contact_form_url',
      type: 'text',
      maxLength: 255,
      admin: { description: 'お問い合わせフォーム URL' },
    },
    {
      name: 'theme_image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'テーマのメインビジュアル' },
    },
    {
      name: 'site_title',
      type: 'text',
      maxLength: 255,
      admin: { description: 'HTMLのtitleタグ用' },
    },
  ],
};
