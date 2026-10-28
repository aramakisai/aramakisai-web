import type { CollectionConfig } from 'payload';

import { blankToNull } from '../hooks/constraints';
import { localSponsorMapConstraint } from '../hooks/local-sponsor-map';
import { sponsorBoothPlacementConstraint } from '../hooks/payload-constraints';
import { signageNotifyHook } from '../lib/signage-notify';

/** 地域協賛カテゴリのruntime値はPayload selectを唯一の定義とする。 */
export const LOCAL_SPONSOR_CATEGORY_OPTIONS = [
  { label: '病院', value: 'hospital' },
  { label: '生活', value: 'life' },
  { label: '車', value: 'car' },
  { label: '教育', value: 'education' },
  { label: '飲食', value: 'food' },
  { label: 'ショップ', value: 'shop' },
] as const;

const isLocal = (data: Record<string, unknown> | undefined) =>
  Array.isArray(data?.type) && data.type.includes('local');

export const Sponsors: CollectionConfig = {
  slug: 'sponsors',
  labels: { singular: '協賛・出店', plural: '協賛・出店' },
  admin: {
    useAsTitle: 'name',
  },
  orderable: true,
  hooks: {
    beforeValidate: [localSponsorMapConstraint, sponsorBoothPlacementConstraint],
    afterChange: [signageNotifyHook(['snapshot'])],
    afterDelete: [signageNotifyHook(['snapshot'])],
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      hasMany: true,
      // select hasMany は required だけで「1 つ以上選択」を満たす (minRows は select に存在しない)
      required: true,
      label: '種別',
      options: [
        { label: '広告協賛', value: 'ad' },
        { label: '地域協賛', value: 'local' },
        { label: '出店協賛', value: 'vendor' },
        { label: 'その他', value: 'other' },
      ],
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: '名称',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'ロゴ画像',
    },
    {
      name: 'url',
      type: 'text',
      maxLength: 500,
      label: 'Webサイト URL',
    },
    {
      name: 'description',
      type: 'textarea',
      label: '説明・応援メッセージ',
    },
    {
      name: 'business_category',
      type: 'select',
      options: [...LOCAL_SPONSOR_CATEGORY_OPTIONS],
      label: '業種タグ',
      admin: {
        description: '地域協賛のみ',
        condition: isLocal,
      },
    },
    {
      name: 'address',
      type: 'text',
      maxLength: 500,
      label: '住所',
      admin: {
        description: '地域協賛のみ',
        condition: isLocal,
      },
    },
    {
      name: 'local_latitude',
      type: 'number',
      min: -90,
      max: 90,
      label: '地域協賛 緯度',
      admin: {
        readOnly: true,
        condition: isLocal,
      },
    },
    {
      name: 'local_longitude',
      type: 'number',
      min: -180,
      max: 180,
      label: '地域協賛 経度',
      admin: {
        readOnly: true,
        condition: isLocal,
      },
    },
    {
      name: 'local_image',
      type: 'upload',
      relationTo: 'media',
      label: '地域協賛 掲載画像',
      admin: {
        condition: isLocal,
      },
    },
    {
      name: 'local_business_hours',
      type: 'textarea',
      label: '地域協賛 営業時間・定休日',
      admin: {
        condition: isLocal,
      },
    },
    {
      name: 'local_phone',
      type: 'text',
      maxLength: 100,
      label: '地域協賛 電話番号',
      admin: {
        condition: isLocal,
      },
    },
    {
      name: 'tier',
      type: 'select',
      label: '協賛プラン',
      options: [
        { label: 'A', value: 'planA' },
        { label: 'B', value: 'planB' },
        { label: 'C', value: 'planC' },
        { label: 'D', value: 'planD' },
      ],
      admin: {
        description: '広告協賛のみ',
        condition: (data) => Array.isArray(data?.type) && data.type.includes('ad'),
      },
    },
    {
      name: 'area_id',
      type: 'relationship',
      relationTo: 'map_areas',
      label: 'マップ配置エリア',
      admin: {
        description: '出店協賛のみ',
        condition: (data) => Array.isArray(data?.type) && data.type.includes('vendor'),
      },
    },
    {
      name: 'booth_number',
      type: 'text',
      maxLength: 20,
      // 重複判定 (collection の beforeValidate) より先に正規化するため field の beforeValidate に置く
      hooks: { beforeValidate: [({ value }) => blankToNull(value)] },
      label: 'ブース番号',
      admin: {
        description: 'エリア内番号 (area_id+booth_number UNIQUE)。出店協賛のみ',
        condition: (data) => Array.isArray(data?.type) && data.type.includes('vendor'),
      },
    },
    {
      name: 'booth_label',
      type: 'text',
      maxLength: 50,
      label: 'マップ表示ラベル',
      admin: {
        description: '出店協賛のみ',
        condition: (data) => Array.isArray(data?.type) && data.type.includes('vendor'),
      },
    },
  ],
};
