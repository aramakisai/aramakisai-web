import type { CollectionConfig } from 'payload';

import { CMS_ROLES } from '../access/roles';

export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'role'] },
  // ローカル認証は実行委員の緊急用。通常経路は Authentik OIDC (auth/strategy.ts)。
  auth: true,
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'student_exhibitor',
      options: CMS_ROLES.map((role) => ({ label: role, value: role })),
      admin: { description: 'ロールはコード上の定義 (CMS_ROLES) からのみ決まる' },
    },
  ],
};
