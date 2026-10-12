import type { GlobalConfig } from 'payload';

import { visibleSlideFilter } from '../lib/signage-visibility';

export const SignageSettings: GlobalConfig = {
  slug: 'signage_settings',
  label: 'サイネージ設定',
  // 固定の操作はサイネージ スライドの画面で行う。保存先としてだけ残す
  admin: { hidden: true },
  fields: [
    {
      name: 'pinned_slide',
      type: 'relationship',
      relationTo: 'signage_slides',
      label: '固定表示するスライド',
      filterOptions: ({ req }) => visibleSlideFilter(req.payload, req),
      admin: { description: '選んだスライドだけを全画面に表示し続けます。空にすると通常の巡回に戻ります。' },
    },
  ],
};
