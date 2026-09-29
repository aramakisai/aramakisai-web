import type { CollectionConfig } from 'payload'

import {
  performanceSlotConstraint,
  performanceTimeConstraint,
  stageAssignmentConstraint,
} from '../hooks/payload-constraints'

export const PerformanceSlots: CollectionConfig = {
  slug: 'performance_slots',
  labels: { singular: 'ステージ出演枠', plural: 'ステージ出演枠' },
  admin: {
    useAsTitle: 'title',
  },
  hooks: {
    beforeValidate: [
      performanceSlotConstraint,
      stageAssignmentConstraint,
      performanceTimeConstraint,
    ],
  },
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
      name: 'event_date',
      type: 'date',
      required: true,
      label: '開催日',
      admin: {
        components: {
          Field: './components/EventDaySelect.tsx',
          Cell: './components/EventDayCell.tsx',
        },
      },
    },
    {
      name: 'start_at',
      type: 'date',
      required: true,
      label: '開始時刻',
      admin: {
        description: '日本時間で入力',
        date: { pickerAppearance: 'timeOnly', displayFormat: 'HH:mm' },
      },
    },
    {
      name: 'end_at',
      type: 'date',
      required: true,
      label: '終了時刻',
      admin: {
        description: '日本時間で入力',
        date: { pickerAppearance: 'timeOnly', displayFormat: 'HH:mm' },
      },
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
}
