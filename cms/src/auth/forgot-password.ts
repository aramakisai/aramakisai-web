import { isOidcEnabled } from '../env';
import { addDataAndFileToRequest, forgotPasswordOperation, headersWithCors, type Endpoint } from 'payload';

/**
 * 招待メール送信済みで未有効化の学生団体と、OIDC 有効時の実行委員は、forgot-password でトークンを発行しない。
 * 匿名で呼べるため、上書きされると本人に届いた招待リンクが無効になる。
 * 応答は通常と同じにし、対象がスキップされたかどうかを外から判別できないようにする。
 */
export const forgotPasswordEndpoint: Endpoint = {
  method: 'post',
  path: '/forgot-password',
  handler: async (req) => {
    // 組み込みのエンドポイントと違い、独自のエンドポイントには本文が自動で載らない
    await addDataAndFileToRequest(req);
    const email = typeof req.data?.email === 'string' ? req.data.email : '';
    const sanitized = email.toLowerCase().trim();
    const skipped =
      sanitized !== '' &&
      (await req.payload.db.findOne({
        collection: 'users',
        req,
        where: {
          email: { equals: sanitized },
          or: [
            {
              role: { equals: 'student_exhibitor' },
              invite_status: { equals: 'sent' },
              activated_at: { exists: false },
            },
            // OIDC 有効時の実行委員は Authentik でしかログインさせないため、リセットトークンも発行しない
            ...(isOidcEnabled() ? [{ role: { equals: 'executive' } }] : []),
          ],
        },
      })) !== null;

    if (!skipped) {
      await forgotPasswordOperation({ collection: req.payload.collections.users, data: { email } as never, req });
    }
    return Response.json(
      { message: req.t('general:success') },
      { headers: headersWithCors({ headers: new Headers(), req }), status: 200 },
    );
  },
};
