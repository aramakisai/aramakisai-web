import path from 'path';
import { fileURLToPath } from 'url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { s3Storage } from '@payloadcms/storage-s3';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import sharp from 'sharp';

import { authentikEndpoints } from './auth/authentik-endpoints';
import { collections } from './collections';
import { optionalEnv, requireEnv } from './env';
import { globals } from './globals';

// S3 未設定のローカル開発ではディスク保存にフォールバックする。本番/staging は Infisical が必ず与える。
const s3Bucket = optionalEnv('S3_BUCKET');

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: 'users',
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections,
  globals,
  // Authentik OIDC を認証の一次経路とする。ローカル認証は実行委員の緊急用として残す
  endpoints: optionalEnv('AUTHENTIK_ISSUER_URL') ? authentikEndpoints : [],
  editor: lexicalEditor(),
  cors: optionalEnv('CMS_CORS_ORIGINS')?.split(',') ?? ['*'],
  // フロントエンドは REST しか使わないため GraphQL は公開しない
  graphQL: { disable: true },
  secret: requireEnv('PAYLOAD_SECRET'),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: { connectionString: requireEnv('DATABASE_URL') },
    migrationDir: path.resolve(dirname, 'migrations'),
    // dev push はコレクション定義に無い制約を DROP する。手書きマイグレーションが入れた
    // CHECK と複合 UNIQUE が接続のたびに消えるため、スキーマ変更は常に migrate 経由にする
    push: false,
  }),
  sharp,
  plugins: s3Bucket
    ? [
        s3Storage({
          collections: {
            // Directus が使う directus-uploads と衝突しないキー空間に置く
            media: { prefix: optionalEnv('S3_PREFIX') ?? 'payload-uploads' },
          },
          bucket: s3Bucket,
          config: {
            endpoint: requireEnv('S3_ENDPOINT'),
            region: requireEnv('S3_REGION'),
            credentials: {
              accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
              secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
            },
          },
        }),
      ]
    : [],
});
