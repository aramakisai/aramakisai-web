import type { CollectionConfig } from 'payload';

export const ParkingLots: CollectionConfig = {
  slug: 'parking_lots',
  labels: { singular: '駐車場', plural: '駐車場' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'updatedAt'],
  },
  defaultSort: 'sort',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: '名称',
    },
    {
      // 既定値を持たせると、登録直後に未確認の「空き」が公開されてしまう
      name: 'status',
      type: 'select',
      required: true,
      label: '空き状況',
      options: [
        { label: '空き', value: 'available' },
        { label: '混雑', value: 'crowded' },
        { label: '満車', value: 'full' },
      ],
    },
    {
      name: 'sort',
      type: 'number',
      label: '表示順',
    },
  ],
};
