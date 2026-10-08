import type { CollectionConfig } from 'payload';

export const LostItems: CollectionConfig = {
  slug: 'lost_items',
  labels: { singular: '落とし物', plural: '落とし物' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'found_place', 'found_at', 'returned'] },
  defaultSort: '-found_at',
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 255, label: '品名' },
    { name: 'found_place', type: 'text', required: true, maxLength: 255, label: '拾得場所' },
    {
      name: 'found_at',
      type: 'date',
      required: true,
      label: '拾得時刻',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'photo', type: 'upload', relationTo: 'media', label: '写真' },
    {
      name: 'returned',
      type: 'checkbox',
      defaultValue: false,
      label: '返却済み',
      admin: { description: '返却済みは画面に表示されない。履歴確認のため削除せず残す' },
    },
  ],
};
