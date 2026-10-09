import type { Where } from 'payload';

import { isExecutive, isStudentExhibitor, type CmsUser } from './roles';

export type AccessResult = boolean | Where;

/** 学生団体ロールに管理画面ナビ・ダッシュボードで見せるコレクション/グローバルの slug。 */
export const EXHIBITOR_VISIBLE = ['student_exhibitions', 'media'] as const;

/** 学生団体に作成を許すコレクション。student_exhibitions は受け皿レコード方式のため対象外。 */
const EXHIBITOR_CREATABLE = ['media'] as const;

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

/** 未認証には見せないコレクション (owner や id で個別に絞るものはここに含めない)。 */
const PRIVATE_COLLECTIONS = ['users'] as const;

function publicRead(collection: string, now: string): AccessResult {
  if ((PRIVATE_COLLECTIONS as readonly string[]).includes(collection)) return false;
  const filter = PUBLISHED_FILTER[collection];
  return filter ? filter(now) : true;
}

function ownerFilter(user: CmsUser): Where {
  return { owner: { equals: user.id } };
}

function selfFilter(user: CmsUser): Where {
  return { id: { equals: user.id } };
}

/**
 * 未認証・学生団体以外に公開する画像。used_in_published は三値で、false だけが非公開。
 * NULL は公開判定の対象外 (実行委員のアップロード・所有者記録の導入前の画像) で常に公開、
 * true は公開企画で使用中。
 *
 * owner.role を条件に含めると users の LEFT JOIN が付き、drizzle が DISTINCT の ID 取得を
 * 先に発行して 1 回の参照が SQL 2 本になるため、自テーブルの列だけで判定する。
 * 学生団体の削除で owner が NULL になっても false のままなので下書き画像は公開されない。
 */
function publicMediaRead(): Where {
  return { used_in_published: { not_equals: false } };
}

export function canRead(
  user: CmsUser | null,
  collection: string,
  now: string = new Date().toISOString(),
): AccessResult {
  if (isExecutive(user)) return true;

  if (collection === 'student_exhibitions') {
    return isStudentExhibitor(user) ? ownerFilter(user!) : publicRead(collection, now);
  }
  if (collection === 'media') {
    return isStudentExhibitor(user) ? ownerFilter(user!) : publicMediaRead();
  }
  if (collection === 'users') {
    return isStudentExhibitor(user) ? selfFilter(user!) : false;
  }

  return publicRead(collection, now);
}

/** 駐車場の作成・削除に連動するフックだけが作る・消す (overrideAccess)。人は更新のみ。 */
const HOOK_MANAGED = ['parking_statuses'] as const;

export function canCreate(user: CmsUser | null, collection: string): boolean {
  if ((HOOK_MANAGED as readonly string[]).includes(collection)) return false;
  if (isExecutive(user)) return true;
  if (isStudentExhibitor(user)) {
    return (EXHIBITOR_CREATABLE as readonly string[]).includes(collection);
  }
  return false;
}

export function canUpdate(user: CmsUser | null, collection: string): AccessResult {
  if (isExecutive(user)) return true;
  if (isStudentExhibitor(user)) {
    if (collection === 'student_exhibitions') {
      return { and: [ownerFilter(user!), { status: { equals: 'draft' } }] };
    }
    if (collection === 'media') {
      return { and: [ownerFilter(user!), { used_in_published: { equals: false } }] };
    }
    if (collection === 'users') return selfFilter(user!);
  }
  return false;
}

export function canDelete(user: CmsUser | null, collection: string): AccessResult {
  if ((HOOK_MANAGED as readonly string[]).includes(collection)) return false;
  if (isExecutive(user)) return true;
  if (isStudentExhibitor(user) && collection === 'media') {
    return { and: [ownerFilter(user!), { used_in_published: { equals: false } }] };
  }
  return false;
}

/** 実行委員以外には、EXHIBITOR_VISIBLE 以外のコレクション・グローバルを管理画面で隠す。 */
export function isHiddenInAdmin(user: CmsUser | null, slug: string): boolean {
  if (isExecutive(user)) return false;
  return !(EXHIBITOR_VISIBLE as readonly string[]).includes(slug);
}
