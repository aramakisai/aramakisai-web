import type { CollectionConfig } from 'payload';

import { executiveOnlyField } from '../access/payload-access';
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
      // 上書き定義。自分のレコードを更新できる出展者が、自分のメールアドレスを
      // 書き換えられないようにする (読み取りは基底のまま制限しない)。
      name: 'email',
      type: 'email',
      access: { update: executiveOnlyField },
    },
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
      // 出展者が自分のレコードを更新できるようになると、自分のロールを書き換えられる。
      // 読み取りは認証後の req.user.role 判定に要るため全員のまま保つ。
      access: { update: executiveOnlyField },
    },
  ],
};
