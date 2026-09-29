import type { CollectionConfig } from 'payload';

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
    { name: 'latitude', type: 'number', required: true, label: '緯度', min: -90, max: 90 },
    { name: 'longitude', type: 'number', required: true, label: '経度', min: -180, max: 180 },
  ],
};
