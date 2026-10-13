import type { CollectionConfig } from 'payload';

import { releasePinIfHidden } from '../lib/signage-pin-release';
import { signageNotifyHook } from '../lib/signage-notify';

const QUAKE_STAGES = [
  { name: 'warning', label: '段階1(身を守る)' },
  { name: 'calm', label: '段階2(揺れは収まりました)' },
  { name: 'evacuate', label: '段階3(指示を待つ・避難場所)' },
  { name: 'cancelled', label: '取消' },
] as const;

const slideIds = (value: unknown): number[] =>
  (Array.isArray(value) ? value : []).map((s) => (typeof s === 'object' && s !== null ? (s as { id: number }).id : s));

export const SignageGroups: CollectionConfig = {
  slug: 'signage_groups',
  labels: { singular: 'サイネージ グループ', plural: 'サイネージ グループ' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'visible'],
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const changed =
          doc.visible !== previousDoc?.visible ||
          slideIds(doc.slides).join() !== slideIds(previousDoc?.slides).join();
        if (changed) await releasePinIfHidden(req.payload, req);
        return doc;
      },
      signageNotifyHook(['pin', 'snapshot']),
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await releasePinIfHidden(req.payload, req);
        return doc;
      },
      signageNotifyHook(['pin', 'snapshot']),
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 30, label: '名前' },
    {
      name: 'visible',
      type: 'checkbox',
      defaultValue: true,
      label: '表示',
      // 緊急地震速報のグループは巡回に出さず、速報の表示中だけ端末が段階のスライドを使う
      admin: { condition: (data) => !data?.is_quake },
    },
    {
      name: 'slides',
      type: 'relationship',
      relationTo: 'signage_slides',
      hasMany: true,
      label: '所属スライド',
      // 「すべて」は全スライドが属するものとして計算し、所属の行は持たない
      access: { update: ({ doc }) => !doc?.is_all },
      admin: {
        condition: (data) => !data?.is_all,
        components: { Field: './components/SignageGroupSlidesField.tsx' },
      },
    },
    {
      name: 'is_all',
      type: 'checkbox',
      defaultValue: false,
      // マイグレーションで作った1件だけが持つ。API から付け外しできないことで「すべて」を1件に保つ
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
    },
    {
      name: 'is_quake',
      type: 'checkbox',
      defaultValue: false,
      // マイグレーションで作った1件だけが持つ。API から付け外しできないことで緊急地震速報のグループを1件に保つ
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
    },
    {
      name: 'quake_slides',
      type: 'group',
      label: '緊急地震速報の段階ごとのスライド',
      admin: { condition: (data) => Boolean(data?.is_quake) },
      fields: QUAKE_STAGES.map(({ name, label }) => ({
        name,
        type: 'relationship' as const,
        relationTo: 'signage_slides' as const,
        label,
        // 所属スライドの保存前の選択は data.slides に反映されている
        filterOptions: ({ data }: { data: Record<string, unknown> }) => {
          const ids = slideIds(data?.slides);
          return ids.length > 0 ? { id: { in: ids } } : { id: { exists: false } };
        },
      })),
    },
  ],
};
