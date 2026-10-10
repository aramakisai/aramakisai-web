import type { CollectionConfig } from 'payload';

import { releasePinIfHidden } from '../lib/signage-pin-release';

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
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await releasePinIfHidden(req.payload, req);
        return doc;
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 30, label: '名前' },
    { name: 'visible', type: 'checkbox', defaultValue: true, label: '表示' },
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
  ],
};
