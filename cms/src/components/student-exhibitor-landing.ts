import type { Payload } from 'payload';

import { isStudentExhibitor, toCmsUser } from '../access/roles';

export async function findOwnExhibitionPath(
  payload: Pick<Payload, 'find' | 'config'>,
  user: unknown,
): Promise<string | null> {
  if (!isStudentExhibitor(toCmsUser(user))) return null;
  // owner は学生団体に読めない項目で where に使えないため、読み取り条件(ownerFilter)に絞り込みを委ねる
  const { docs } = await payload.find({
    collection: 'student_exhibitions',
    user: user as never,
    overrideAccess: false,
    depth: 0,
    limit: 1,
  });
  const id = docs[0]?.id;
  return id === undefined ? null : `${payload.config.routes.admin}/collections/student_exhibitions/${id}`;
}
