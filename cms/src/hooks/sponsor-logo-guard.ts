import type { CollectionBeforeDeleteHook } from 'payload';
import { APIError } from 'payload';

export const guardSponsorLogo: CollectionBeforeDeleteHook = async ({ id, req }) => {
  // shortcut: 参照確認後の同時登録は保護できない。並行操作を保証する場合は削除処理を見直す。
  const { totalDocs } = await req.payload.count({
    collection: 'sponsors',
    where: { logo: { equals: id } },
    overrideAccess: true,
    req,
  });
  if (totalDocs > 0) {
    throw new APIError('協賛者のロゴとして使用中の画像は削除できません。', 400, undefined, true);
  }
};
