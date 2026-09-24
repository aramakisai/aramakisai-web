import type { PayloadRequest, Where } from 'payload';

import type { Media, StudentExhibition } from '../payload-types';

const IMAGE_CATEGORIES = ['stage', 'exhibit', 'vendor', 'other'] as const;

function mediaId(value: number | Media): number {
  return typeof value === 'number' ? value : value.id;
}

/** 企画の 4 カテゴリの images から画像 ID を集める。カテゴリ未選択時は該当グループが無いため無視してよい。 */
export function collectImageIds(doc: Partial<StudentExhibition> | null | undefined): number[] {
  if (!doc) return [];
  const ids = new Set<number>();
  for (const category of IMAGE_CATEGORIES) {
    for (const image of doc[category]?.images ?? []) {
      ids.add(mediaId(image));
    }
  }
  return [...ids];
}

/**
 * 指定した media ID それぞれについて、公開中の企画から参照されているかを再計算して used_in_published に書き込む。
 * where 指定の bulk update は失敗を例外にせず戻り値の errors に入れて返すため、ここで throw して
 * 呼び出し元 (企画の保存) のトランザクションごと巻き戻す。
 */
export async function syncMediaPublication(
  req: PayloadRequest,
  mediaIds: readonly number[],
): Promise<void> {
  if (mediaIds.length === 0) return;

  const publishedUses = await req.payload.find({
    collection: 'student_exhibitions',
    where: {
      and: [
        { status: { equals: 'published' } },
        { or: IMAGE_CATEGORIES.map((category) => ({ [`${category}.images`]: { in: mediaIds } })) },
      ],
    },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  });

  const referenced = new Set(publishedUses.docs.flatMap((doc) => collectImageIds(doc)));
  const usedIds = mediaIds.filter((id) => referenced.has(id));
  const unusedIds = mediaIds.filter((id) => !referenced.has(id));

  const groups: { ids: number[]; used_in_published: boolean }[] = [
    { ids: usedIds, used_in_published: true },
    { ids: unusedIds, used_in_published: false },
  ];
  const writes = await Promise.all(
    groups
      .filter(({ ids }) => ids.length > 0)
      .map(({ ids, used_in_published }) =>
        req.payload.update({
          collection: 'media',
          where: { id: { in: ids } } satisfies Where,
          data: { used_in_published },
          overrideAccess: true,
          req,
        }),
      ),
  );

  const errors = writes.flatMap((result) => result.errors);
  if (errors.length > 0) {
    throw new Error(`media.used_in_published の更新に失敗しました: ${JSON.stringify(errors)}`);
  }
}
