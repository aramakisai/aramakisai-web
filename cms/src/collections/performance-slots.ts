import type { CollectionConfig } from 'payload';

import { performanceSlotConstraint, stageAssignmentConstraint } from '../hooks/payload-constraints';

export const PerformanceSlots: CollectionConfig = {
  slug: 'performance_slots',
  labels: { singular: 'ステージ出演枠', plural: 'ステージ出演枠' },
  admin: {
    useAsTitle: 'title',
  },
  hooks: { beforeValidate: [performanceSlotConstraint, stageAssignmentConstraint] },
  fields: [
    {
      name: 'stage_id',
      type: 'relationship',
      relationTo: 'stages',
      required: true,
      label: 'ステージ',
      admin: { description: 'NOT NULL' },
    },
    {
      name: 'time_slot_id',
      type: 'relationship',
      relationTo: 'time_slots',
      required: true,
      label: 'タイムスロット',
      admin: { description: 'NOT NULL' },
    },
    {
      name: 'exhibition_id',
      type: 'relationship',
      relationTo: 'student_exhibitions',
      label: '団体',
      admin: { description: 'NULL可。団体なし出演はtitleを使用' },
    },
    {
      name: 'title',
      type: 'text',
      maxLength: 255,
      label: '表示名',
      admin: { description: 'exhibition_idがNULLの場合必須' },
    },
  ],
};
