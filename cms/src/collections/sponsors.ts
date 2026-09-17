import type { CollectionConfig } from 'payload';

import { boothPlacementConstraint } from '../hooks/payload-constraints';

export const Sponsors: CollectionConfig = {
  slug: 'sponsors',
  admin: {
    useAsTitle: 'name',
  },
  defaultSort: 'sort',
  hooks: { beforeValidate: [boothPlacementConstraint('sponsors')] },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'sponsor',
      options: [
        { label: 'ad', value: 'ad' },
        { label: 'sponsor', value: 'sponsor' },
        { label: 'food_truck', value: 'food_truck' },
        { label: 'other', value: 'other' },
      ],
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'ロゴ画像' },
    },
    {
      name: 'url',
      type: 'text',
      maxLength: 500,
      admin: { description: 'Webサイト URL' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: '説明・応援メッセージ' },
    },
    {
      name: 'business_category',
      type: 'text',
      maxLength: 100,
      admin: { description: '業種タグ (地元協賛のみ)' },
    },
    {
      name: 'address',
      type: 'text',
      maxLength: 500,
      admin: { description: '住所 (地元協賛のみ)' },
    },
    {
      name: 'tier',
      type: 'select',
      options: [
        { label: 'platinum', value: 'platinum' },
        { label: 'gold', value: 'gold' },
        { label: 'silver', value: 'silver' },
        { label: 'bronze', value: 'bronze' },
      ],
      admin: { description: '協賛ランク (広告協賛のみ)' },
    },
    {
      name: 'area_id',
      type: 'relationship',
      relationTo: 'map_areas',
      admin: { description: 'マップ配置エリア (広告協賛はNULL)' },
    },
    {
      name: 'booth_number',
      type: 'number',
      admin: { description: 'エリア内ブース番号 (area_id+booth_number UNIQUE)' },
    },
    {
      name: 'booth_label',
      type: 'text',
      maxLength: 50,
      admin: { description: 'マップ表示ラベル' },
    },
    {
      name: 'sort',
      type: 'number',
      admin: { description: '表示順' },
    },
  ],
};
