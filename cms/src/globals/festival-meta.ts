import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { GlobalConfig } from 'payload';

export const FestivalMeta: GlobalConfig = {
  slug: 'festival_meta',
  label: '祭基本情報',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: '祭名',
    },
    {
      name: 'event_days',
      type: 'array',
      label: '開催日程',
      fields: [
        {
          name: 'start_at',
          type: 'date',
          required: true,
          label: '開場日時',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'end_at',
          type: 'date',
          required: true,
          label: '終了日時',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'label',
          type: 'text',
          label: '表示ラベル',
          admin: { description: '例: 1日目。未入力時は開場日時から生成する' },
        },
      ],
    },
    {
      name: 'parking_map',
      type: 'upload',
      relationTo: 'media',
      label: '駐車場マップ画像',
    },
    {
      name: 'sns_links',
      type: 'json',
      label: 'SNSリンク一覧',
    },
    {
      name: 'overview',
      type: 'richText',
      label: '祭概要',
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
      label: 'ヒーロー画像',
      admin: { description: 'Aboutページ用' },
    },
    {
      name: 'theme_word',
      type: 'text',
      maxLength: 255,
      label: 'テーマ',
      admin: { description: '例: 万彩' },
    },
    {
      name: 'theme_description',
      type: 'richText',
      label: 'テーマの説明文',
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
      label: '会場名',
    },
    {
      name: 'campus_map_url',
      type: 'text',
      maxLength: 255,
      label: 'Google Maps 埋め込み URL',
    },
    {
      name: 'contact_form_url',
      type: 'text',
      maxLength: 255,
      label: 'お問い合わせフォーム URL',
    },
    {
      name: 'theme_image',
      type: 'upload',
      relationTo: 'media',
      label: 'テーマのメインビジュアル',
    },
    {
      name: 'site_title',
      type: 'text',
      maxLength: 255,
      label: 'サイトタイトル',
      admin: { description: 'HTMLのtitleタグ用' },
    },
    {
      name: 'access_summary',
      type: 'textarea',
      label: 'アクセス文言',
      admin: { description: '最寄り駅・バス等からの行き方を数行で。詳細はアクセスページが担う' },
    },
    {
      name: 'meta_description',
      type: 'textarea',
      maxLength: 200,
      label: 'サイト説明文 (meta description)',
      admin: { description: '検索結果・SNS共有時のサイト説明文。未入力時は祭概要から自動生成' },
    },
    {
      name: 'og_image',
      type: 'upload',
      relationTo: 'media',
      label: '既定 OG 画像',
      admin: { description: 'SNS共有時の既定画像。未設定時はサイト同梱の既定画像を使用' },
    },
    {
      name: 'venue_address',
      type: 'text',
      maxLength: 255,
      label: '会場住所',
      admin: { description: '構造化データ用の会場住所(郵便番号から)' },
    },
  ],
};
