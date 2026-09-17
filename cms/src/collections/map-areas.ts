import type { CollectionConfig } from 'payload';

export const MapAreas: CollectionConfig = {
  slug: 'map_areas',
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
      admin: { description: '表示名 (例: "Aゾーン")' },
    },
    {
      name: 'geometry',
      type: 'json',
      required: true,
      admin: { description: 'GeoJSON Polygon' },
    },
    {
      name: 'sort',
      type: 'number',
      admin: { description: '表示順' },
    },
  ],
};
