import type { CollectionConfig } from 'payload';

import { CMS_ROLES } from '../access/roles';

export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'role'] },
  // ローカル認証は実行委員の緊急用。通常経路は Authentik OIDC (auth/strategy.ts)。
  auth: true,
  fields: [
    {
      // Authentik はメールアドレスの変更を許すため、突合は不変の sub で行う。
      // email で突合すると変更時に別ユーザーが作られ、student_exhibitions.owner の
      // unique 制約により本人が新しいレコードを作れなくなる
      name: 'authentik_sub',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'Authentik の sub。OIDC ログイン時に設定される' },
    },
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
