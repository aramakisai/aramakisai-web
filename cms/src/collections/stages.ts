import type { CollectionConfig } from 'payload';

export const Stages: CollectionConfig = {
  slug: 'stages',
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
      admin: { description: 'ステージ名' },
    },
    {
      name: 'area_id',
      type: 'relationship',
      relationTo: 'map_areas',
      admin: { description: '出演場所エリア (OSM Polygon)' },
    },
    {
      name: 'sort',
      type: 'number',
      admin: { description: '表示順' },
    },
  ],
};
