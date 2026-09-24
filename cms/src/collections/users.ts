import { randomBytes } from 'crypto';
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  CollectionConfig,
} from 'payload';
import { APIError } from 'payload';

import { denyField, executiveOnlyField } from '../access/payload-access';
import { CMS_ROLES, isExecutive, toCmsUser, type CmsRole } from '../access/roles';

const INVITE_STATUSES = [
  { label: '送信済み', value: 'sent' },
  { label: '送信失敗', value: 'failed' },
] as const;

const ROLE_LABELS: Record<CmsRole, string> = {
  executive: '実行委員',
  student_exhibitor: '出展者',
};

/**
 * 出展者ロール (未指定時の既定値を含む) の作成では、管理画面・API のどちらから届いた
 * パスワードも使わない。パスワードは招待メールのリンクからしか設定させないため。
 */
const replaceInitialPassword: CollectionBeforeOperationHook = (arg) => {
  if (arg.operation !== 'create') return arg.args;
  const role = ((arg.args.data as { role?: CmsRole } | undefined)?.role ??
    'student_exhibitor') as CmsRole;
  if (role !== 'student_exhibitor') return arg.args;
  return { ...arg.args, data: { ...arg.args.data, password: randomBytes(32).toString('hex') } };
};

/**
 * resetPassword はトークンの有効性を自前のメッセージ (M-E06) で案内するため、
 * Payload 既定の "Token is either invalid or has expired." より先に検査する。
 */
const guardResetToken: CollectionBeforeOperationHook = async (arg) => {
  if (arg.operation !== 'resetPassword') return arg.args;
  const found = await arg.req.payload.db.findOne({
    collection: 'users',
    req: arg.req,
    where: {
      resetPasswordToken: { equals: arg.args.data.token },
      resetPasswordExpiration: { greater_than: new Date().toISOString() },
    },
  });
  if (!found) {
    throw new APIError(
      'リンクが無効なため、実行委員に招待メールの再送を依頼してください。',
      403,
      undefined,
      true,
    );
  }
  return arg.args;
};

/**
 * 実行委員が resend_invite にチェックして保存した対象を req.context に退避する。
 * afterChange で消費してからキューに入れることで、forgotPassword / 記録更新が
 * 起こす再度の afterChange でジョブが二重に積まれないようにする。
 */
const captureResendInvite: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  if (operation === 'update' && data?.resend_invite === true && isExecutive(toCmsUser(req.user))) {
    req.context.resendInviteFor = originalDoc?.id;
    delete data.resend_invite;
  }
  return data;
};

const queueInvitationEmail: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  const isResendTarget = req.context.resendInviteFor === doc.id;
  if (isResendTarget) delete req.context.resendInviteFor;

  const shouldQueue = (operation === 'create' || isResendTarget) && doc.role === 'student_exhibitor';
  if (!shouldQueue) return doc;

  await req.payload.jobs.queue({ task: 'sendInvitation', input: { userId: doc.id }, req });
  return doc;
};

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'ユーザー', plural: 'ユーザー' },
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'role', 'invite_status'] },
  // ローカル認証は実行委員の緊急用。通常経路は Authentik OIDC (auth/strategy.ts)。
  auth: true,
  hooks: {
    beforeOperation: [replaceInitialPassword, guardResetToken],
    beforeChange: [captureResendInvite],
    afterChange: [queueInvitationEmail],
  },
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
      access: { read: executiveOnlyField, update: executiveOnlyField },
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
      access: { create: executiveOnlyField, update: executiveOnlyField },
    },
    {
      name: 'invite_status',
      type: 'select',
      label: '招待メール',
      options: INVITE_STATUSES.map(({ label, value }) => ({ label, value })),
      access: { read: executiveOnlyField, create: denyField, update: denyField },
    },
    {
      name: 'invite_sent_at',
      type: 'date',
      label: '招待送信日時',
      access: { read: executiveOnlyField, create: denyField, update: denyField },
    },
    {
      name: 'invite_error',
      type: 'text',
      label: '送信エラー',
      access: { read: executiveOnlyField, create: denyField, update: denyField },
    },
    {
      name: 'resend_invite',
      type: 'checkbox',
      label: '招待メールを再送',
      // 列を持たない指示フラグ。beforeChange が req.context に移してから消す
      virtual: true,
      access: { create: executiveOnlyField, update: executiveOnlyField },
    },
    {
      // 新規作成画面でだけ、パスワード欄・確認欄に自動入力する (Users セクション参照)。
      name: 'initial_password_autofill',
      type: 'ui',
      admin: { components: { Field: './components/AutoFillInitialPassword.tsx' } },
    },
  ],
};
