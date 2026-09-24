import type {
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  CollectionConfig,
  Where,
} from 'payload';
import { APIError } from 'payload';

import { denyField, executiveOnlyField } from '../access/payload-access';
import { isStudentExhibitor, toCmsUser } from '../access/roles';

/**
 * フロントエンドが要求する表示幅の実測値は 1920 / 960 / 無指定 の 3 種。
 * 無指定は原本 (WebP 変換済み) が受け持つため、生成するのはこの 2 サイズでよい。
 */
export const IMAGE_SIZES = [
  { name: 'hero', width: 1920 },
  { name: 'card', width: 960 },
] as const;

/** アップロード時に owner をアップロード者、used_in_published を未使用として記録する。 */
const assignMediaOwner: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation !== 'create') return data;
  return { ...data, owner: req.user?.id ?? null, used_in_published: false };
};

/**
 * 一括操作 (where 指定) は access の Where が使用中の画像を黙って対象から外すため、
 * access 評価より前のここで判定しないと M-E05 を返せない (ID 指定の単体操作も同じ経路を通る)。
 */
const guardPublishedMedia: CollectionBeforeOperationHook = async ({
  args,
  operation,
  overrideAccess,
  req,
}) => {
  if (operation !== 'update' && operation !== 'delete') return args;
  if (overrideAccess) return args;

  const user = toCmsUser(req.user);
  if (!isStudentExhibitor(user)) return args;

  const target = args as { id?: number | string; where?: Where };
  const targetWhere: Where | null =
    target.id != null ? { id: { equals: target.id } } : (target.where ?? null);
  if (!targetWhere) return args;

  const { totalDocs } = await req.payload.count({
    collection: 'media',
    where: {
      and: [targetWhere, { owner: { equals: user!.id } }, { used_in_published: { equals: true } }],
    },
    overrideAccess: true,
    req,
  });
  if (totalDocs > 0) {
    throw new APIError('公開中の企画で使用中の画像は変更・削除できません。', 403, undefined, true);
  }
  return args;
};

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'メディア', plural: 'メディア' },
  endpoints: [
    {
      // フロントエンドはファイル ID とサイズ名しか持たないため、実ファイルへの解決はここで行う。
      // 変換はせず、生成済みの派生へ 302 で送るだけ。
      path: '/serve/:id/:size',
      method: 'get',
      handler: async (req) => {
        const { id, size } = req.routeParams as { id: string; size: string };
        // Local API は overrideAccess を既定で true にするため、明示しないと read access が評価されない
        const doc = await req.payload
          .findByID({ collection: 'media', id, depth: 0, overrideAccess: false, req })
          .catch(() => null);
        if (!doc) return Response.json({ errors: [{ message: 'not found' }] }, { status: 404 });

        const sizes = (doc.sizes ?? {}) as Record<string, { url?: string | null } | undefined>;
        const url = size === 'original' ? doc.url : (sizes[size]?.url ?? doc.url);
        if (!url) return Response.json({ errors: [{ message: 'not found' }] }, { status: 404 });

        return new Response(null, { status: 302, headers: { Location: url } });
      },
    },
  ],
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: '代替テキスト',
      admin: {
        description: '画像の内容を短い文で説明してください。画像読込み時にエラーが発生した場合などに表示されます。',
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      label: 'アップロード者',
      access: { read: executiveOnlyField, create: executiveOnlyField, update: executiveOnlyField },
    },
    {
      name: 'used_in_published',
      type: 'checkbox',
      label: '公開企画で使用中',
      // 値は media-publication の同期処理だけが overrideAccess で書く
      access: { create: denyField, update: denyField },
    },
  ],
  upload: {
    // 配信時変換を行わないため、アップロード時に WebP へ寄せる
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: IMAGE_SIZES.map(({ name, width }) => ({
      name,
      width,
      // 原本より大きいサイズは生成しない。要求幅を満たせない場合は原本が最大となる
      withoutEnlargement: true,
      formatOptions: { format: 'webp' as const, options: { quality: 82 } },
    })),
  },
  hooks: {
    beforeOperation: [guardPublishedMedia],
    beforeChange: [assignMediaOwner],
    afterChange: [
      ({ doc, req }) => {
        // 生成失敗や原本より大きいサイズ指定でも保存は中断せず、欠落だけ警告として残す
        const generated = new Set(Object.keys((doc?.sizes as object) ?? {}));
        const missing = IMAGE_SIZES.map((s) => s.name).filter(
          (name) => !generated.has(name) || !doc?.sizes?.[name]?.filename,
        );
        if (missing.length > 0) {
          req.payload.logger.warn(
            `media id=${doc?.id} 派生サイズ未生成: ${missing.join(', ')} (原本は保持されている)`,
          );
        }
        return doc;
      },
    ],
  },
};
