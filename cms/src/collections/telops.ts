import type { CollectionConfig } from 'payload';

export const Telops: CollectionConfig = {
  slug: 'telops',
  labels: { singular: 'サイネージ テロップ', plural: 'サイネージ テロップ' },
  orderable: true,
  admin: {
    useAsTitle: 'body',
    defaultColumns: ['body', 'audience', 'enabled'],
    // ドラッグ並べ替えはページをまたげないため、全件を1ページに収める
    pagination: { defaultLimit: 100 },
  },
  fields: [
    {
      name: 'audience',
      type: 'select',
      required: true,
      defaultValue: 'visitor',
      label: '対象区分',
      options: [
        { label: '来場者向け', value: 'visitor' },
        { label: '参加団体向け', value: 'group' },
      ],
    },
    {
      name: 'target',
      type: 'text',
      required: true,
      maxLength: 20,
      defaultValue: 'ご来場のみなさまへ',
      label: 'ラベル',
      admin: { description: '例: ご来場のみなさまへ、出店団体へ' },
    },
    { name: 'body', type: 'text', required: true, maxLength: 200, label: '文面' },
    { name: 'enabled', type: 'checkbox', defaultValue: true, label: '有効' },
  ],
};
