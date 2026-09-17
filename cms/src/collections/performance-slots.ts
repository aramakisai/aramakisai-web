import type { CollectionConfig } from 'payload';

import { performanceSlotConstraint } from '../hooks/payload-constraints';

export const PerformanceSlots: CollectionConfig = {
  slug: 'performance_slots',
  admin: {
    useAsTitle: 'title',
  },
  hooks: { beforeValidate: [performanceSlotConstraint] },
  fields: [
    {
      name: 'stage_id',
      type: 'relationship',
      relationTo: 'stages',
      required: true,
      admin: { description: 'ステージ (NOT NULL)' },
    },
    {
      name: 'time_slot_id',
      type: 'relationship',
      relationTo: 'time_slots',
      required: true,
      admin: { description: 'タイムスロット (NOT NULL)' },
    },
    {
      name: 'exhibition_id',
      type: 'relationship',
      relationTo: 'student_exhibitions',
      admin: { description: '団体 (NULL可。団体なし出演はtitleを使用)' },
    },
    {
      name: 'title',
      type: 'text',
      maxLength: 255,
      admin: { description: '表示名 (exhibition_idがNULLの場合必須)' },
    },
  ],
};
