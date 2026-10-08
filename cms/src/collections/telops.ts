import type { CollectionConfig, Validate } from 'payload';

export const Telops: CollectionConfig = {
  slug: 'telops',
  labels: { singular: 'サイネージ テロップ', plural: 'サイネージ テロップ' },
  admin: { useAsTitle: 'body', defaultColumns: ['body', 'audience', 'enabled', 'sort'] },
  defaultSort: 'sort',
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
      maxLength: 20,
      label: '対象',
      admin: {
        description: '例: 出店団体へ',
        condition: (data) => data?.audience === 'group',
      },
      // 区分で必須が変わるため required ではなく検証で判定する
      validate: ((value, { siblingData }) => {
        if ((siblingData as { audience?: string }).audience !== 'group') return true;
        return typeof value === 'string' && value.trim() !== '' ? true : '参加団体向けには対象が必要です';
      }) as Validate,
    },
    { name: 'body', type: 'text', required: true, maxLength: 200, label: '文面' },
    { name: 'enabled', type: 'checkbox', defaultValue: true, label: '有効' },
    { name: 'sort', type: 'number', label: '並び順' },
  ],
};
