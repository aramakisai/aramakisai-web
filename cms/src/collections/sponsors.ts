import type { CollectionConfig } from 'payload';

import { boothPlacementConstraint } from '../hooks/payload-constraints';

export const Sponsors: CollectionConfig = {
  slug: 'sponsors',
  labels: { singular: '協賛・出店', plural: '協賛・出店' },
  admin: {
    useAsTitle: 'name',
  },
  defaultSort: 'sort',
  hooks: { beforeValidate: [boothPlacementConstraint('sponsors')] },
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
      type: 'text',
      maxLength: 100,
      label: '業種タグ',
      admin: {
        description: '地域協賛のみ',
        condition: (data) => Array.isArray(data?.type) && data.type.includes('local'),
      },
    },
    {
      name: 'address',
      type: 'text',
      maxLength: 500,
      label: '住所',
      admin: {
        description: '地域協賛のみ',
        condition: (data) => Array.isArray(data?.type) && data.type.includes('local'),
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
      type: 'number',
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
    {
      name: 'sort',
      type: 'number',
      label: '表示順',
    },
  ],
};
