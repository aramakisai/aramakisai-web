import { forgotPasswordOperation, headersWithCors, type Endpoint } from 'payload';

/**
 * 招待メール送信済みで未有効化の学生団体は、forgot-password でトークンを上書きさせない。
 * 匿名で呼べるため、上書きされると本人に届いた招待リンクが無効になる。
 * 応答は通常と同じにし、対象が招待中かどうかを外から判別できないようにする。
 */
export const forgotPasswordEndpoint: Endpoint = {
  method: 'post',
  path: '/forgot-password',
  handler: async (req) => {
    const email = typeof req.data?.email === 'string' ? req.data.email : '';
    const sanitized = email.toLowerCase().trim();
    const invited =
      sanitized !== '' &&
      (await req.payload.db.findOne({
        collection: 'users',
        req,
        where: {
          email: { equals: sanitized },
          role: { equals: 'student_exhibitor' },
          invite_status: { equals: 'sent' },
          activated_at: { exists: false },
        },
      })) !== null;

    if (!invited) {
      await forgotPasswordOperation({ collection: req.payload.collections.users, data: { email } as never, req });
    }
    return Response.json(
      { message: req.t('general:success') },
      { headers: headersWithCors({ headers: new Headers(), req }), status: 200 },
    );
  },
};
