import type { CollectionConfig } from 'payload';

export const ParkingStatuses: CollectionConfig = {
  slug: 'parking_statuses',
  labels: { singular: '空き状況', plural: '空き状況' },
  admin: {
    defaultColumns: ['lot', 'status', 'updatedAt'],
  },
  fields: [
    {
      name: 'lot',
      type: 'relationship',
      relationTo: 'parking_lots',
      required: true,
      unique: true,
      label: '駐車場',
      // 当日の更新操作で別の駐車場へ付け替えて、他の駐車場の状況を壊さないようにする。
      // 作成は駐車場側のフックが overrideAccess で行うので影響しない
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
    {
      // 既定値を持たせると、登録直後に未確認の「空き」が公開されてしまう
      name: 'status',
      type: 'select',
      label: '空き状況',
      // 自動作成直後は未設定で、公開ページには出さない。更新時にだけ未設定へ戻せなくする
      validate: (value: unknown, { operation }: { operation?: string }) =>
        operation === 'update' && !value ? '空き状況を選択してください' : true,
      options: [
        { label: '空き', value: 'available' },
        { label: '混雑', value: 'crowded' },
        { label: '満車', value: 'full' },
      ],
    },
  ],
};
