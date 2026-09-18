import type { CollectionConfig } from 'payload';

export const TimeSlots: CollectionConfig = {
  slug: 'time_slots',
  labels: { singular: 'タイムスロット', plural: 'タイムスロット' },
  admin: {
    useAsTitle: 'label',
  },
  defaultSort: 'sort',
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      maxLength: 50,
      label: '表示ラベル',
    },
    {
      name: 'start_at',
      type: 'date',
      required: true,
      label: '開始時刻',
      admin: {
        date: { pickerAppearance: 'timeOnly', displayFormat: 'HH:mm' },
      },
    },
    {
      name: 'end_at',
      type: 'date',
      required: true,
      label: '終了時刻',
      admin: {
        date: { pickerAppearance: 'timeOnly', displayFormat: 'HH:mm' },
      },
    },
    {
      name: 'sort',
      type: 'number',
      label: '時系列順',
    },
  ],
};
