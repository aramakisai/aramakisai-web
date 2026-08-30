import type { Access } from 'payload';

import { canCreate, canDelete, canRead, canUpdate } from './policy';
import { toCmsUser } from './roles';

/**
 * Payload の `access` は boolean か Where を返す契約であり、policy の戻り値をそのまま渡せる。
 * ここは policy を Payload の呼び出し規約へ写すだけの薄い層に保つ。
 */
export function accessFor(collection: string): {
  read: Access;
  create: Access;
  update: Access;
  delete: Access;
} {
  return {
    read: ({ req }) => canRead(toCmsUser(req.user), collection),
    create: ({ req }) => canCreate(toCmsUser(req.user), collection),
    update: ({ req }) => canUpdate(toCmsUser(req.user), collection),
    delete: ({ req }) => canDelete(toCmsUser(req.user), collection),
  };
}
