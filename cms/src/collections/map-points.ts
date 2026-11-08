import type { CollectionConfig } from 'payload'

export const MapPoints: CollectionConfig = {
  slug: 'map_points',
  labels: { singular: 'マップ地点', plural: 'マップ地点' },
  admin: {
    useAsTitle: 'kind',
    defaultColumns: ['kind', 'latitude', 'longitude'],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      label: '種別',
      options: [
        { label: 'ごみステーション', value: 'garbage_station' },
        { label: '受付', value: 'reception' },
      ],
    },
    {
      name: 'label',
      type: 'text',
      label: '表示名',
      admin: { description: '受付の表示名。空欄の場合は「受付」と表示します。' },
    },
    {
      name: 'reception_type', type: 'select', label: '受付の種類', defaultValue: 'general',
      options: [{ label: '一般受付', value: 'general' }, { label: 'お笑いライブ受付', value: 'comedy' }],
      admin: { condition: (data) => data.kind === 'reception' },
    },
    {
      name: 'poster', type: 'upload', relationTo: 'media', label: 'お笑いライブのポスター',
      admin: { condition: (data) => data.kind === 'reception' && data.reception_type === 'comedy' },
    },
    {
      name: 'event_topic', type: 'relationship', relationTo: 'topics', label: 'お笑いライブのトピック',
      admin: { condition: (data) => data.kind === 'reception' && data.reception_type === 'comedy' },
    },
    { name: 'latitude', type: 'number', required: true, label: '緯度', min: -90, max: 90 },
    { name: 'longitude', type: 'number', required: true, label: '経度', min: -180, max: 180 },
  ],
}
