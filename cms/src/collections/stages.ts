import type { CollectionConfig } from 'payload';

export const Stages: CollectionConfig = {
  slug: 'stages',
  labels: { singular: 'ステージ', plural: 'ステージ' },
  admin: {
    useAsTitle: 'name',
  },
  defaultSort: 'sort',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: 'ステージ名',
    },
    {
      name: 'area_id',
      type: 'relationship',
      relationTo: 'map_areas',
      label: '出演場所エリア',
      admin: { description: 'OSM Polygon' },
    },
    {
      name: 'sort',
      type: 'number',
      label: '表示順',
    },
  ],
};
