import type { CollectionConfig } from 'payload';

import { CMS_ROLES, type CmsRole } from '../access/roles';

const ROLE_LABELS: Record<CmsRole, string> = {
  executive: '実行委員',
  student_exhibitor: '出展者',
};

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'ユーザー', plural: 'ユーザー' },
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'role'] },
  // ローカル認証は実行委員の緊急用。通常経路は Authentik OIDC (auth/strategy.ts)。
  auth: true,
  fields: [
    {
      // Authentik はメールアドレスの変更を許すため、突合は不変の sub で行う。
      // email で突合すると変更時に別ユーザーが作られ、student_exhibitions.owner の
      // unique 制約により本人が新しいレコードを作れなくなる。
      // IdP 移行で sub の体系が変わったときだけ、auth/authentik-endpoints.ts が
      // email で引き当てて一度だけ張り替える
      name: 'authentik_sub',
      type: 'text',
      unique: true,
      index: true,
      label: 'Authentik sub',
      admin: { readOnly: true, description: 'Authentik の sub。OIDC ログイン時に設定される' },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'student_exhibitor',
      label: 'ロール',
      options: CMS_ROLES.map((role) => ({ label: ROLE_LABELS[role], value: role })),
      admin: { description: 'ロールはコード上の定義 (CMS_ROLES) からのみ決まる' },
    },
  ],
};
