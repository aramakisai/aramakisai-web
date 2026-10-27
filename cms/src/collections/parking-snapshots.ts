import type { CollectionConfig, Field } from 'payload';

import { denyField, executiveOnlyField } from '../access/payload-access';

/** 作成・更新はフックが overrideAccess で行う。管理画面では確認用に読み取りのみ出す */
const recorded = {
  admin: { readOnly: true },
  access: { read: executiveOnlyField, create: denyField, update: denyField },
} as const;

const recordedDate = (name: string, label: string): Field => ({
  name,
  type: 'date',
  label,
  ...recorded,
  admin: { ...recorded.admin, date: { pickerAppearance: 'dayAndTime' } },
});

export const ParkingSnapshots: CollectionConfig = {
  slug: 'parking_snapshots',
  labels: { singular: '駐車場の画像', plural: '駐車場の画像' },
  admin: {
    defaultColumns: ['filename', 'camera', 'lot', 'createdAt', 'judge_status', 'congestion', 'image_quality'],
  },
  upload: {
    // 原寸は受信した JPEG をそのまま保存する。公開側は縮小版だけを使う
    imageSizes: [
      {
        name: 'web',
        width: 960,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 75 } },
      },
    ],
    adminThumbnail: 'web',
    // ファイル名は推測できない乱数で書き換えないため、長期キャッシュしてよい
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    },
  },
  fields: [
    {
      name: 'camera',
      type: 'relationship',
      relationTo: 'parking_cameras' as never,
      required: true,
      index: true,
      label: 'カメラ',
      ...recorded,
    },
    {
      name: 'lot',
      type: 'relationship',
      relationTo: 'parking_lots',
      index: true,
      label: '割り当て先',
      admin: { readOnly: true },
      access: { create: denyField, update: denyField },
    },
    { name: 'exposure', type: 'number', min: -2, max: 2, label: '露出補正値', ...recorded },
    {
      name: 'judge_status',
      type: 'select',
      label: '判定',
      options: [
        { label: '判定待ち', value: 'pending' },
        { label: '成功', value: 'succeeded' },
        { label: '失敗', value: 'failed' },
        { label: '見送り', value: 'skipped' },
      ],
      ...recorded,
    },
    { name: 'judge_error', type: 'text', label: '失敗・見送りの理由', ...recorded },
    {
      name: 'congestion',
      type: 'select',
      label: '混雑',
      options: [
        { label: '空き', value: 'available' },
        { label: '混雑', value: 'crowded' },
        { label: '満車', value: 'full' },
        { label: '不明', value: 'unknown' },
      ],
      ...recorded,
    },
    {
      name: 'image_quality',
      type: 'select',
      label: '写り具合',
      options: [
        { label: '良好', value: 'ok' },
        { label: '暗い', value: 'too_dark' },
        { label: '明るい', value: 'too_bright' },
        { label: '色かぶり', value: 'color_cast' },
      ],
      ...recorded,
    },
    { name: 'judge_model', type: 'text', label: '判定に使ったモデル', ...recorded },
    recordedDate('judged_at', '判定を終えた時刻'),
    {
      name: 'captured_at',
      type: 'date',
      required: true,
      label: '撮影時刻',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
      access: { create: denyField, update: denyField },
    },
  ],
};
