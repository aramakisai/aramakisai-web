import type { CollectionConfig } from 'payload';

import { isExecutive, toCmsUser } from '../access/roles';
import { boothPlacementConstraint } from '../hooks/payload-constraints';

export const StudentExhibitions: CollectionConfig = {
  slug: 'student_exhibitions',
  admin: {
    useAsTitle: 'name',
  },
  hooks: { beforeValidate: [boothPlacementConstraint('student_exhibitions')] },
  fields: [
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      // 現行スキーマの user_created UNIQUE (1 ユーザー 1 レコード) を引き継ぐ
      unique: true,
      admin: { description: '所有者。出展者はこのレコードのみ編集できる' },
      hooks: {
        // 出展者が owner を指定できると、unique 制約により他人の枠を先に埋めて
        // その人がレコードを作れない状態にできる。実行委員のみ指定を許す。
        beforeChange: [
          ({ previousValue, req, value }) =>
            isExecutive(toCmsUser(req.user))
              ? (value ?? req.user?.id)
              : (previousValue ?? req.user?.id),
        ],
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'published', value: 'published' },
        { label: 'draft', value: 'draft' },
      ],
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      admin: { description: '企画名。団体名は organization_name を参照' },
    },
    {
      name: 'organization_name',
      type: 'text',
      required: true,
      maxLength: 255,
      admin: { description: '学生団体・サークル名' },
    },
    {
      name: 'category',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['other'],
      options: [
        { label: 'stage', value: 'stage' },
        { label: 'exhibit', value: 'exhibit' },
        { label: 'vendor', value: 'vendor' },
        { label: 'other', value: 'other' },
      ],
      admin: { description: '最大 2 つまで選択する' },
    },
    {
      name: 'performance_slots',
      type: 'join',
      collection: 'performance_slots',
      on: 'exhibition_id',
      admin: { description: 'ステージ出演枠 (実行委員が割り当てる。閲覧のみ)' },
    },
    {
      name: 'area_id',
      type: 'relationship',
      relationTo: 'map_areas',
      admin: { description: 'マップ配置エリア (NULL=マップ非掲載)。展示・出店のみ使用' },
    },
    {
      name: 'booth_number',
      type: 'number',
      admin: { description: 'エリア内ブース番号 (area_id+booth_number UNIQUE)。展示・出店のみ使用' },
    },
    {
      name: 'booth_label',
      type: 'text',
      maxLength: 50,
      admin: { description: 'マップ表示ラベル。展示・出店のみ使用' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: '一覧表示用短文' },
    },
    {
      name: 'links',
      type: 'json',
      admin: { description: '公式サイト・SNS 等のリンク' },
    },
    {
      name: 'images',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: { description: '最大 5 枚まで' },
    },
  ],
};
