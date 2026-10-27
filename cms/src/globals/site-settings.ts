import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { GlobalConfig } from 'payload';

import { validateMonitorEnd, validateMonitorStart } from '../lib/parking-monitor';
import { signageNotifyGlobalHook } from '../lib/signage-notify';

export const SiteSettings: GlobalConfig = {
  slug: 'site_settings',
  label: 'サイト設定',
  hooks: { afterChange: [signageNotifyGlobalHook(['snapshot'])] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: '基本',
          fields: [
            { name: 'name', type: 'text', required: true, maxLength: 255, label: '祭名' },
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
              name: 'theme_word',
              type: 'text',
              maxLength: 255,
              label: 'テーマ',
              admin: { description: '例: 万彩' },
            },
            { name: 'theme_description', type: 'richText', label: 'テーマの説明文' },
            lexicalHTMLField({
              htmlFieldName: 'theme_description_html',
              lexicalFieldName: 'theme_description',
              storeInDB: true,
            }),
          ],
        },
        {
          label: 'トップページ',
          fields: [
            {
              name: 'hero_images',
              type: 'upload',
              relationTo: 'media',
              hasMany: true,
              label: 'ヒーロー画像',
              admin: { description: '複数枚設定可' },
            },
          ],
        },
        {
          label: 'About',
          fields: [
            { name: 'overview', type: 'richText', label: '祭概要' },
            lexicalHTMLField({
              htmlFieldName: 'overview_html',
              lexicalFieldName: 'overview',
              storeInDB: true,
            }),
          ],
        },
        {
          label: '連絡先',
          fields: [
            {
              name: 'contact_form_url',
              type: 'text',
              maxLength: 255,
              label: 'お問い合わせフォーム URL',
            },
            {
              name: 'exhibitor_contact_url',
              type: 'text',
              maxLength: 255,
              label: '学生団体向け問い合わせ先URL',
              admin: { description: '学生団体への招待メールに記載されます。' },
              validate: (value: unknown) =>
                !value || (typeof value === 'string' && URL.canParse(value) && value.startsWith('https://'))
                  ? true
                  : 'URL は https:// で始まる形式で入力してください',
            },
            { name: 'sns_links', type: 'json', label: 'SNSリンク一覧' },
          ],
        },
        {
          label: '駐車場カメラ',
          fields: [
            {
              name: 'parking_monitor',
              type: 'group',
              label: '監視時間',
              admin: { description: '日本時間。この時間内に撮影された画像だけを受け付け、稼働の監視もこの時間内に行います。' },
              fields: [
                {
                  name: 'start',
                  type: 'text',
                  label: '開始',
                  defaultValue: '09:00',
                  admin: { description: 'HH:mm 形式 (例: 09:00)' },
                  validate: validateMonitorStart,
                },
                {
                  name: 'end',
                  type: 'text',
                  label: '終了',
                  defaultValue: '17:30',
                  admin: { description: 'HH:mm 形式 (例: 17:30)。この時刻ちょうどは監視時間内' },
                  validate: validateMonitorEnd,
                },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              name: 'og_image',
              type: 'upload',
              relationTo: 'media',
              label: '既定 OG 画像',
              admin: { description: 'SNS共有時の既定画像。未設定時はサイト同梱の既定画像を使用' },
            },
          ],
        },
      ],
    },
  ],
};
