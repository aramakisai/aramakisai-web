import { sql } from '@payloadcms/db-postgres';
import type { PayloadRequest } from 'payload';

import { optionalEnv } from '../env';
import { invitationHtml, invitationSubject } from './email-templates';

/** 招待リンクの有効期限。発行 (再送を含む) から 72 時間の固定値 */
export const INVITATION_EXPIRATION_MS = 72 * 60 * 60 * 1000;

export type InvitationResult =
  | { readonly kind: 'sent'; readonly expiresAt: Date }
  | { readonly kind: 'failed'; readonly reason: string }
  | { readonly kind: 'skipped' };

/**
 * このジョブがこの招待の送信権を取ったことを users に記録する。取れたら true。
 * Payload 3.x のジョブ取得には排他がなく、複数レプリカが同じジョブを同時に実行しうる。
 * 条件付き UPDATE は DB 側で直列化されるため、同じジョブ ID の 2 回目以降は 0 行になる。
 * 管理画面の再送や失敗後の再投入は別ジョブ (別 ID) なので常に取れる。
 * ジョブのトランザクションに乗せると commit まで他 Pod から見えないため、別接続で即 commit する。
 * 取得後に落ちても印はそのジョブ ID にしか効かず、再送を妨げない。
 */
async function claimSend(req: PayloadRequest, userId: number, jobId: number | string): Promise<boolean> {
  const result = await req.payload.db.drizzle.execute(sql`
    UPDATE "users" SET "invite_claimed_job" = ${Number(jobId)}
    WHERE "id" = ${userId} AND "invite_claimed_job" IS DISTINCT FROM ${Number(jobId)}
    RETURNING "id"`);
  return result.rows.length > 0;
}

async function attemptSend(req: PayloadRequest, userId: number): Promise<Exclude<InvitationResult, { kind: 'skipped' }>> {
  try {
    // 本番で SMTP_HOST 未設定はコンソール出力アダプタへの静かなフォールバックを意味し、
    // 送信済みと誤記録されるため、送信前に検出して失敗として扱う。
    if (optionalEnv('NODE_ENV') === 'production' && !optionalEnv('SMTP_HOST')) {
      throw new Error('メール送信の設定がありません');
    }

    const user = await req.payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
      req,
    });
    // 問い合わせ先は送信を試みるたびに読む。未設定でも送信は続行し、本文の
    // 問い合わせ先部分は invitationHtml 側で省く。
    const meta = await req.payload.findGlobal({ slug: 'site_settings', overrideAccess: true, req });
    const contactUrl = meta.exhibitor_contact_url ?? undefined;
    const token = await req.payload.forgotPassword({
      collection: 'users',
      data: { email: user.email },
      disableEmail: true,
      expiration: INVITATION_EXPIRATION_MS,
      req,
    });
    if (!token) throw new Error('パスワード設定トークンを発行できませんでした');

    const cmsPublicUrl = (optionalEnv('CMS_PUBLIC_URL') ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const resetUrl = `${cmsPublicUrl}/admin/reset/${token}`;
    const loginUrl = `${cmsPublicUrl}/admin/login`;

    await req.payload.sendEmail({
      to: user.email,
      subject: invitationSubject(),
      html: invitationHtml({ resetUrl, loginUrl, contactUrl }),
    });

    return { kind: 'sent', expiresAt: new Date(Date.now() + INVITATION_EXPIRATION_MS) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    req.payload.logger.error({ userId, reason }, 'invitation failed');
    return { kind: 'failed', reason };
  }
}

/**
 * ジョブ `sendInvitation` のハンドラから呼ぶ (commit 後に実行される)。
 * トークン発行・送信の失敗は例外にせず、users の invite_* に記録してから返す。
 * 記録そのもの (payload.update) の失敗はここでは捕まえず、ジョブの再試行に任せる。
 */
export async function sendInvitation({
  req,
  userId,
  jobId,
}: {
  readonly req: PayloadRequest;
  readonly userId: number;
  readonly jobId: number | string;
}): Promise<InvitationResult> {
  const user = await req.payload.findByID({
    collection: 'users',
    id: userId,
    overrideAccess: true,
    req,
  });
  // 設定済みの人にトークンを再発行すると、本人のパスワードとは無関係に設定リンクが出回るため
  // 何も変更せず終える (invite_* も触らない)。
  if (user.activated_at) return { kind: 'skipped' };

  // 同じジョブの重複実行は送信も記録もしない。後続の失敗が先行の sent を上書きするのを防ぐ。
  if (!(await claimSend(req, userId, jobId))) return { kind: 'skipped' };

  const result = await attemptSend(req, userId);

  await req.payload.update({
    collection: 'users',
    id: userId,
    data:
      result.kind === 'sent'
        ? { invite_status: 'sent', invite_sent_at: new Date().toISOString(), invite_error: null }
        : { invite_status: 'failed', invite_error: `送信に失敗しました: ${result.reason}` },
    overrideAccess: true,
    req,
  });

  return result;
}
