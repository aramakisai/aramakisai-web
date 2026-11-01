import type { Access, FieldAccess } from 'payload';

import { publicFilter } from '../lib/signage-visibility';

import { canCreate, canDelete, canRead, canReadMediaFile,canReadVersions, canUpdate } from './policy';
import { isExecutive, toCmsUser } from './roles';

/**
 * Payload の `access` は boolean か Where を返す契約であり、policy の戻り値をそのまま渡せる。
 * ここは policy を Payload の呼び出し規約へ写すだけの薄い層に保つ。
 */
export function accessFor(collection: string): {
  read: Access;
  create: Access;
  update: Access;
  delete: Access;
  readVersions: Access;
} {
  return {
    read: async ({ req, isReadingStaticFile }) => {
      // isReadingStaticFile は Payload の checkFileAccess (/api/media/file/:filename) だけが立てる
      if (collection === 'media' && isReadingStaticFile) return canReadMediaFile(toCmsUser(req.user));
      const result = canRead(toCmsUser(req.user), collection);
      // 公開判定が条件を返すとき(未認証・学生団体)だけ、非表示グループのスライド・テロップを配らないよう絞る
      if ((collection === 'signage_slides' || collection === 'telops') && typeof result === 'object') {
        return { and: [result, await publicFilter(req.payload, collection, req)] };
      }
      return result;
    },
    readVersions: ({ req }) => canReadVersions(toCmsUser(req.user), collection),
    create: ({ req }) => canCreate(toCmsUser(req.user), collection),
    update: ({ req }) => canUpdate(toCmsUser(req.user), collection),
    delete: ({ req }) => {
      const result = canDelete(toCmsUser(req.user), collection);
      // 文書ごとの判定に使われるため、「すべて」・緊急地震速報の編集画面のメニューに削除が出ず、一覧の一括削除でも残る
      if (collection === 'signage_groups' && result === true) {
        return { and: [{ is_all: { not_equals: true } }, { is_quake: { not_equals: true } }] };
      }
      return result;
    },
  };
}

/** 実行委員だけが対象操作を行える。Local API の overrideAccess では評価されない */
export const executiveOnlyField: FieldAccess = ({ req }) => isExecutive(toCmsUser(req.user));

/** 誰もフォーム・API から書けない。フックが overrideAccess で書く値に使う */
export const denyField: FieldAccess = () => false;
