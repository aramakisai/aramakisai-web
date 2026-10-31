/**
 * 既存メディアに派生サイズ small (幅 640) を後から作る。hero / card / 原本には触らない。
 *
 * Payload には派生サイズだけを作り直す API が無い。payload.update は条件次第で何も生成せず、
 * 再アップロード経路は原本と全サイズを削除してから上書きするため、どちらも使わない。
 *
 * 既定は dry-run (対象の一覧のみ)。--apply で S3 への PutObject と DB の更新を行う。
 *
 * 実行例:
 *   NODE_OPTIONS=--import=tsx/esm node scripts/backfill-media-small.ts [--apply]
 *   (DATABASE_URL / PAYLOAD_SECRET / S3_* は payload.config.ts と同じ環境変数)
 */
import path from 'node:path';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getPayload } from 'payload';
import sharp from 'sharp';

import configPromise from '../src/payload.config';
import { IMAGE_SIZES } from '../src/collections/media';
import { optionalEnv, requireEnv } from '../src/env';

const apply = process.argv.includes('--apply');
const SIZE = IMAGE_SIZES.find((s) => s.name === 'small')!;

const s3 = new S3Client({
  endpoint: requireEnv('S3_ENDPOINT'),
  region: requireEnv('S3_REGION'),
  credentials: {
    accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
  },
});
const bucket = requireEnv('S3_BUCKET');
const defaultPrefix = optionalEnv('S3_PREFIX') ?? 'payload-uploads';

// storage-s3 の getFileKey は行の prefix を collection の prefix より優先する
const keyOf = (prefix: string | null | undefined, filename: string) =>
  path.posix.join(prefix || defaultPrefix, filename);

const payload = await getPayload({ config: configPromise });

const hostOf = (raw: string) => new URL(raw).host;
console.log(
  `接続先: DB=${hostOf(requireEnv('DATABASE_URL'))} S3=${hostOf(requireEnv('S3_ENDPOINT'))} bucket=${bucket}`,
);

const { docs } = await payload.find({
  collection: 'media',
  depth: 0,
  pagination: false,
  sort: 'id',
  overrideAccess: true,
});
const targets = docs.filter(
  (d) => d.mimeType?.startsWith('image/') && d.filename && !d.sizes?.small?.filename,
);

console.log(`${apply ? 'apply' : 'dry-run'}: 対象 ${targets.length} 件`);
console.log(`id: ${targets.map((d) => d.id).join(', ')}`);

const failed: Array<number | string> = [];
if (apply) {
  for (const doc of targets) {
    try {
      const original = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: keyOf(doc.prefix, doc.filename!) }),
      );
      const input = Buffer.from(await original.Body!.transformToByteArray());

      // createImageSizes と同じ処理: 自動回転 → resize(設定そのまま) → webp。
      // アニメーション形式は全フレームを読み、高さはフレーム数で割る。
      const animated = ['image/avif', 'image/gif', 'image/webp'].includes(doc.mimeType!);
      const base = sharp(input, animated ? { animated: true } : {}).rotate();
      const meta = await base.metadata();
      const { data, info } = await base
        .clone()
        .resize({ width: SIZE.width, withoutEnlargement: true })
        .toFormat('webp', { quality: 82 })
        .toBuffer({ resolveWithObject: true });
      const height = animated && meta.pages ? info.height / meta.pages : info.height;

      const stem = doc.filename!.slice(0, doc.filename!.lastIndexOf('.')) || doc.filename!;
      const filename = `${stem}-${info.width}x${height}.webp`;

      // 原本が幅 640 以下だと card / hero と同名になり、中身も同じなので書き込まない
      const shared = [doc.sizes?.hero?.filename, doc.sizes?.card?.filename].includes(filename);
      if (!shared) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: keyOf(doc.prefix, filename),
            Body: data,
            ContentType: 'image/webp',
          }),
        );
      }

      // payload.update は hooks とアップロード処理が走るため、アダプタで small の列だけを更新する
      await payload.db.updateOne({
        collection: 'media',
        id: doc.id,
        returning: false,
        data: {
          sizes: {
            small: {
              filename,
              filesize: info.size,
              height,
              mimeType: 'image/webp',
              // hero / card の既存行と同じ形式で保存する (読み出し時は afterRead が組み立て直す)
              url: `/api/media/file/${encodeURIComponent(filename)}`,
              width: info.width,
            },
          },
        },
      });
      console.log(`ok id=${doc.id} ${filename}${shared ? ' (既存ファイルを共有)' : ''}`);
    } catch (err) {
      failed.push(doc.id);
      console.error(`NG id=${doc.id}`, err instanceof Error ? err.message : err);
    }
  }
  if (failed.length) console.error(`失敗 ${failed.length} 件: ${failed.join(', ')}`);
}

process.exit(failed.length ? 1 : 0);
