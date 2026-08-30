import type { CollectionConfig } from 'payload';

export const TimeSlots: CollectionConfig = {
  slug: 'time_slots',
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
      admin: { description: '表示ラベル' },
    },
    {
      name: 'start_at',
      type: 'date',
      required: true,
      admin: {
        description: '開始時刻',
        date: { pickerAppearance: 'timeOnly', displayFormat: 'HH:mm' },
      },
    },
    {
      name: 'end_at',
      type: 'date',
      required: true,
      admin: {
        description: '終了時刻',
        date: { pickerAppearance: 'timeOnly', displayFormat: 'HH:mm' },
      },
    },
    {
      name: 'sort',
      type: 'number',
      admin: { description: '時系列順' },
    },
  ],
};
