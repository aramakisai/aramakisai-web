import type { Where } from 'payload';

import { isExecutive, isStudentExhibitor, type CmsUser } from './roles';

export type AccessResult = boolean | Where;

/** 出展者ロールに管理画面ナビ・ダッシュボードで見せるコレクション/グローバルの slug。 */
export const EXHIBITOR_VISIBLE = ['student_exhibitions', 'media'] as const;

/** 出展者に作成を許すコレクション。student_exhibitions は受け皿レコード方式のため対象外。 */
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
 * 未認証・出展者以外に公開する画像: 所有者記録の導入前から存在する画像、所有者が実行委員、
 * または公開企画で使用中のいずれか。
 *
 * 「所有者なし」は所有者記録の導入前から存在する画像に限定するため used_in_published も
 * 未設定であることを併せて見る。所有者記録の導入後に作成された画像は作成時のフックが必ず
 * used_in_published へ true/false を入れるため、NULL のままなのは移行前の行だけである。
 * これが無いと、出展者ユーザーの削除で owner が NULL になった未公開の下書き画像が
 * 未認証に公開されてしまう (media.owner_id は ON DELETE SET NULL)。
 */
function publicMediaRead(): Where {
  return {
    or: [
      { and: [{ owner: { exists: false } }, { used_in_published: { exists: false } }] },
      { 'owner.role': { equals: 'executive' } },
      { used_in_published: { equals: true } },
    ],
  };
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

export function canCreate(user: CmsUser | null, collection: string): boolean {
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
