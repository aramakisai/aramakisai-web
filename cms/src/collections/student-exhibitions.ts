import type { CollectionConfig, GroupField } from 'payload';

import { isExecutive, toCmsUser } from '../access/roles';
import {
  boothPlacementConstraint,
  categoryContentsConstraint,
  stageCategoryConstraint,
} from '../hooks/payload-constraints';

const CATEGORIES = [
  { name: 'stage', label: 'ステージ' },
  { name: 'exhibit', label: '展示' },
  { name: 'vendor', label: '出店' },
  { name: 'other', label: 'その他' },
] as const;

function categoryContentGroup(name: (typeof CATEGORIES)[number]['name'], label: string): GroupField {
  return {
    name,
    type: 'group',
    label: `${label}の企画内容`,
    admin: {
      description: `カテゴリで「${label}」を選択したときだけ表示する`,
      condition: (data) => Array.isArray(data?.categories) && data.categories.includes(name),
      // 一括編集はレコードごとの categories を評価できず condition が働かないため、
      // カテゴリを問わず入力欄が常に選択候補へ出てしまう。個別編集画面に限定する
      disableBulkEdit: true,
    },
    fields: [
      { name: 'name', type: 'text', maxLength: 255, label: '企画名' },
      { name: 'description', type: 'textarea', label: '紹介文' },
      {
        name: 'images',
        type: 'upload',
        relationTo: 'media',
        hasMany: true,
        label: '画像',
        admin: { description: '最大 5 枚まで' },
      },
    ],
  };
}

export const StudentExhibitions: CollectionConfig = {
  slug: 'student_exhibitions',
  labels: { singular: '学生企画', plural: '学生企画' },
  admin: {
    useAsTitle: 'organization_name',
  },
  hooks: {
    beforeValidate: [
      boothPlacementConstraint('student_exhibitions'),
      categoryContentsConstraint,
      stageCategoryConstraint,
    ],
  },
  fields: [
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      // 現行スキーマの user_created UNIQUE (1 ユーザー 1 レコード) を引き継ぐ
      unique: true,
      label: '所有者',
      // 出展者は users を read できず、管理画面のセレクトが解決できない。
      // 値は下の beforeChange が決めるため、フォームには出さない
      admin: { hidden: true },
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
      label: '公開状態',
      options: [
        { label: '公開', value: 'published' },
        { label: '下書き', value: 'draft' },
      ],
    },
    {
      name: 'organization_name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: '団体名',
      admin: { description: '学生団体・サークル名' },
    },
    {
      name: 'categories',
      type: 'select',
      hasMany: true,
      // select hasMany は required だけで「1 つ以上選択」を満たす (minRows は select に存在しない)
      required: true,
      label: 'カテゴリ',
      options: CATEGORIES.map(({ name, label }) => ({ label, value: name })),
      admin: { description: '1 つ以上選択する (上限なし)' },
    },
    ...CATEGORIES.map(({ name, label }) => categoryContentGroup(name, label)),
    {
      name: 'performance_slots',
      type: 'join',
      collection: 'performance_slots',
      on: 'exhibition_id',
      label: 'ステージ出演枠',
      admin: { description: '実行委員が割り当てる。閲覧のみ' },
    },
    {
      name: 'area_id',
      type: 'relationship',
      relationTo: 'map_areas',
      label: 'マップ配置エリア',
      admin: { description: 'NULL=マップ非掲載。展示・出店のみ使用' },
    },
    {
      name: 'booth_number',
      type: 'number',
      label: 'ブース番号',
      admin: { description: 'エリア内番号 (area_id+booth_number UNIQUE)。展示・出店のみ使用' },
    },
    {
      name: 'booth_label',
      type: 'text',
      maxLength: 50,
      label: 'マップ表示ラベル',
      admin: { description: '展示・出店のみ使用' },
    },
    {
      name: 'links',
      type: 'array',
      label: 'リンク',
      admin: { description: '公式サイト・SNS 等のリンク (並べ替えた順に表示する)' },
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          label: 'プラットフォーム',
          options: [
            { label: 'X', value: 'x' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'TikTok', value: 'tiktok' },
            { label: 'LINE', value: 'line' },
            { label: 'ホームページ', value: 'website' },
          ],
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          label: 'URL',
          validate: (value: unknown) =>
            typeof value === 'string' && URL.canParse(value) && value.startsWith('https://')
              ? true
              : 'URL は https:// で始まる形式で入力してください',
        },
      ],
    },
  ],
};
