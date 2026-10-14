import type { ServerProps } from 'payload';
import { redirect } from 'next/navigation';

import { findOwnExhibitionPath } from './student-exhibitor-landing';

export default async function StudentExhibitorRedirect({ payload, user }: ServerProps) {
  const path = await findOwnExhibitionPath(payload, user);
  // redirect() は例外で遷移するため try/catch の外で呼ぶ
  if (path) redirect(path);
  return null;
}
