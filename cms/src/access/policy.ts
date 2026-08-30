import type { Where } from 'payload';

import { isExecutive, isStudentExhibitor, type CmsUser } from './roles';

export type AccessResult = boolean | Where;

/** 所有者フィールドを持つコレクション。出展者が編集できるのはここだけ。 */
export const OWNED_COLLECTIONS = ['student_exhibitions'] as const;

/** 出展者に作成を許すコレクション。media は自企画の画像添付に必要なため含める。 */
const EXHIBITOR_CREATABLE = ['student_exhibitions', 'media'] as const;

/** 未認証には見せないコレクション。 */
const PRIVATE_COLLECTIONS = ['users'] as const;

/**
 * 公開状態の判定基準はコレクションごとに異なる。ここに無いコレクションは
 * 公開状態フィールドを持たず、未認証でも全件読める。
 */
const PUBLISHED_FILTER: Record<string, (now: string) => Where> = {
  announcements: (now) => ({
    published_at: { less_than_equal: now, exists: true },
  }),
  topics: (now) => ({
    published_at: { less_than_equal: now, exists: true },
  }),
  student_exhibitions: () => ({ status: { equals: 'published' } }),
};

function isOwned(collection: string): boolean {
  return (OWNED_COLLECTIONS as readonly string[]).includes(collection);
}

function publicRead(collection: string, now: string): AccessResult {
  if ((PRIVATE_COLLECTIONS as readonly string[]).includes(collection)) return false;
  const filter = PUBLISHED_FILTER[collection];
  return filter ? filter(now) : true;
}

function ownerFilter(user: CmsUser): Where {
  return { owner: { equals: user.id } };
}

export function canRead(
  user: CmsUser | null,
  collection: string,
  now: string = new Date().toISOString(),
): AccessResult {
  if (isExecutive(user)) return true;

  if (isStudentExhibitor(user) && isOwned(collection)) {
    const published = publicRead(collection, now);
    if (published === true) return true;
    if (published === false) return ownerFilter(user!);
    return { or: [published, ownerFilter(user!)] };
  }

  return publicRead(collection, now);
}

export function canCreate(user: CmsUser | null, collection: string): boolean {
  if (isExecutive(user)) return true;
  if (isStudentExhibitor(user)) {
    return (EXHIBITOR_CREATABLE as readonly string[]).includes(collection);
  }
  return false;
}

function canWrite(user: CmsUser | null, collection: string): AccessResult {
  if (isExecutive(user)) return true;
  if (isStudentExhibitor(user) && isOwned(collection)) return ownerFilter(user!);
  return false;
}

export function canUpdate(user: CmsUser | null, collection: string): AccessResult {
  return canWrite(user, collection);
}

export function canDelete(user: CmsUser | null, collection: string): AccessResult {
  return canWrite(user, collection);
}
