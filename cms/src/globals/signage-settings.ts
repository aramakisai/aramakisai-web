import type { GlobalConfig } from 'payload';

export const SignageSettings: GlobalConfig = {
  slug: 'signage_settings',
  label: 'サイネージ設定',
  fields: [
    {
      name: 'pinned_slide',
      type: 'relationship',
      relationTo: 'signage_slides',
      label: '固定表示するスライド',
      filterOptions: { enabled: { equals: true } },
      admin: { description: '選んだスライドだけを全画面に表示し続けます。空にすると通常の巡回に戻ります。' },
    },
  ],
};
