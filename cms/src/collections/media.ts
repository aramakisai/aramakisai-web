import type { CollectionConfig } from 'payload';

/**
 * フロントエンドが要求する表示幅の実測値は 1920 / 960 / 無指定 の 3 種。
 * 無指定は原本 (WebP 変換済み) が受け持つため、生成するのはこの 2 サイズでよい。
 */
export const IMAGE_SIZES = [
  { name: 'hero', width: 1920 },
  { name: 'card', width: 960 },
] as const;

export const Media: CollectionConfig = {
  slug: 'media',
  endpoints: [
    {
      // フロントエンドはファイル ID とサイズ名しか持たないため、実ファイルへの解決はここで行う。
      // 変換はせず、生成済みの派生へ 302 で送るだけ。
      path: '/serve/:id/:size',
      method: 'get',
      handler: async (req) => {
        const { id, size } = req.routeParams as { id: string; size: string };
        const doc = await req.payload
          .findByID({ collection: 'media', id, depth: 0, req })
          .catch(() => null);
        if (!doc) return Response.json({ errors: [{ message: 'not found' }] }, { status: 404 });

        const sizes = (doc.sizes ?? {}) as Record<string, { url?: string | null } | undefined>;
        const url = size === 'original' ? doc.url : (sizes[size]?.url ?? doc.url);
        if (!url) return Response.json({ errors: [{ message: 'not found' }] }, { status: 404 });

        return new Response(null, { status: 302, headers: { Location: url } });
      },
    },
  ],
  fields: [{ name: 'alt', type: 'text' }],
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
