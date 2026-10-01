import type { CollectionConfig } from 'payload'

import { performanceSlotName } from '../hooks/performance-slot-name'
import {
  performanceSlotConstraint,
  performanceTimeConstraint,
  stageAssignmentConstraint,
} from '../hooks/payload-constraints'

export const PerformanceSlots: CollectionConfig = {
  slug: 'performance_slots',
  labels: { singular: 'ステージ出演枠', plural: 'ステージ出演枠' },
  admin: {
    useAsTitle: 'display_name',
    listSearchableFields: ['display_name', 'title'],
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
      // useAsTitle は列を持たない仮想フィールドしか使えず、素の virtual: true は拒否されるため
      // 団体名への関連パスで宣言する。値は DB の結合で引かれ、追加クエリは走らない
      name: 'display_name',
      type: 'text',
      label: '表示名',
      virtual: 'exhibition_id.organization_name',
      admin: { hidden: true },
      access: { create: () => false, update: () => false },
      hooks: {
        // 団体が無い行は結合結果が空になるため、表示名へ切り替える
        afterRead: [({ value, data }) => performanceSlotName(value, data?.title)],
      },
    },
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
      filterOptions: { categories: { in: ['stage'] } },
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
