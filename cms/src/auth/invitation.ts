import type { PayloadRequest } from 'payload';

import { optionalEnv } from '../env';
import { invitationHtml, invitationSubject } from './email-templates';

/** 招待リンクの有効期限。発行 (再送を含む) から 72 時間の固定値 */
export const INVITATION_EXPIRATION_MS = 72 * 60 * 60 * 1000;

export type InvitationResult =
  | { readonly kind: 'sent'; readonly expiresAt: Date }
  | { readonly kind: 'failed'; readonly reason: string };

async function attemptSend(req: PayloadRequest, userId: number): Promise<InvitationResult> {
  try {
    const user = await req.payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
      req,
    });
    // 問い合わせ先は送信を試みるたびに読む。未設定でも送信は続行し、本文の
    // 問い合わせ先部分は invitationHtml 側で省く。
    const meta = await req.payload.findGlobal({ slug: 'festival_meta', overrideAccess: true, req });
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
}: {
  readonly req: PayloadRequest;
  readonly userId: number;
}): Promise<InvitationResult> {
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
