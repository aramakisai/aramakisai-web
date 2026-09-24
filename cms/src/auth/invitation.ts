import type { PayloadRequest } from 'payload';

/** 招待リンクの有効期限。発行 (再送を含む) から 72 時間の固定値 */
export const INVITATION_EXPIRATION_MS = 72 * 60 * 60 * 1000;

export type InvitationResult =
  | { readonly kind: 'sent'; readonly expiresAt: Date }
  | { readonly kind: 'failed'; readonly reason: string };

/**
 * ジョブ `sendInvitation` のハンドラから呼ぶ (commit 後に実行される)。
 * トークン発行・送信の失敗は例外にせず、users の invite_* に記録してから返す。
 */
export async function sendInvitation(_args: {
  readonly req: PayloadRequest;
  readonly userId: number;
}): Promise<InvitationResult> {
  // stub: トークン発行・送信・記録は未実装
  return { kind: 'failed', reason: 'not implemented yet' };
}
