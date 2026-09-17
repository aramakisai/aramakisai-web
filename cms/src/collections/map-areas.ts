import type { CollectionConfig } from 'payload';

export const MapAreas: CollectionConfig = {
  slug: 'map_areas',
  labels: { singular: 'マップエリア', plural: 'マップエリア' },
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
      label: '表示名',
      admin: { description: '例: "Aゾーン"' },
    },
    {
      name: 'geometry',
      type: 'json',
      required: true,
      label: '図形',
      admin: { description: 'GeoJSON Polygon' },
    },
    {
      name: 'sort',
      type: 'number',
      label: '表示順',
    },
  ],
};
