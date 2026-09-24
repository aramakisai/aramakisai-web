import path from 'path';
import { fileURLToPath } from 'url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { s3Storage } from '@payloadcms/storage-s3';
import { ja } from '@payloadcms/translations/languages/ja';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import sharp from 'sharp';

import { isExecutive, toCmsUser } from './access/roles';
import { authentikEndpoints } from './auth/authentik-endpoints';
import { sendInvitation } from './auth/invitation';
import { collections } from './collections';
import { optionalEnv, requireEnv } from './env';
import { globals } from './globals';
import { richTextEditorFeatures } from './lib/rich-text-editor';

// S3 未設定のローカル開発ではディスク保存にフォールバックする。本番/staging は Infisical が必ず与える。
const s3Bucket = optionalEnv('S3_BUCKET');
// docker-mailserver への接続先。infisical run --env=prod には入らないため、ローカルは常にコンソール出力になる。
const smtpHost = optionalEnv('SMTP_HOST');

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: 'users',
    importMap: { baseDir: path.resolve(dirname) },
    // OIDC 一次経路化により通常ログインはここから遷移する (endpoints は authentikEndpoints 参照)。
    // components: undefined を明示的に渡すと Payload が admin.components.views を読めず
    // 管理画面全体が落ちるため、無効時はキーごと省く。
    ...(optionalEnv('AUTHENTIK_ISSUER_URL')
      ? {
          components: { afterLogin: ['./components/ZitadelLoginButton.tsx'] },
        }
      : {}),
  },
  collections,
  globals,
  // Authentik OIDC を認証の一次経路とする。ローカル認証は実行委員の緊急用として残す
  endpoints: optionalEnv('AUTHENTIK_ISSUER_URL') ? authentikEndpoints : [],
  editor: lexicalEditor({ features: richTextEditorFeatures }),
  // 利用者は実行委員のみで英語需要がないため、言語切替を出さず ja に固定する
  i18n: {
    supportedLanguages: { ja },
    fallbackLanguage: 'ja',
  },
  cors: optionalEnv('CMS_CORS_ORIGINS')?.split(',') ?? ['*'],
  // フロントエンドは REST しか使わないため GraphQL は公開しない
  graphQL: { disable: true },
  email: smtpHost
    ? nodemailerAdapter({
        defaultFromAddress: 'noreply@aramakisai.com',
        defaultFromName: '荒牧祭実行委員会広報部',
        transportOptions: {
          host: smtpHost,
          port: 587,
          requireTLS: true,
          auth: { user: 'noreply@aramakisai.com', pass: requireEnv('NOREPLY_SMTP_PASSWORD') },
          // 証明書のホスト名は Service 名 (smtpHost) と別のため明示する
          tls: { servername: 'mail.aramakisai.com' },
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 10_000,
        },
      })
    : undefined,
  jobs: {
    tasks: [
      {
        slug: 'sendInvitation',
        retries: 2,
        inputSchema: [{ name: 'userId', type: 'number', required: true }],
        handler: async ({ input, req }) => {
          await sendInvitation({ req, userId: input.userId });
          return { output: {} };
        },
      },
    ],
    autoRun: [{ cron: '*/10 * * * * *' }],
    // vitest はプロセス全体に VITEST=true を設定する。テストは payload.jobs.run() を明示的に呼ぶ
    shouldAutoRun: () => !process.env.VITEST,
    jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
      ...defaultJobsCollection,
      access: {
        read: ({ req }) => isExecutive(toCmsUser(req.user)),
        create: ({ req }) => isExecutive(toCmsUser(req.user)),
        update: ({ req }) => isExecutive(toCmsUser(req.user)),
        delete: ({ req }) => isExecutive(toCmsUser(req.user)),
      },
    }),
  },
  secret: requireEnv('PAYLOAD_SECRET'),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
    // 自動生成は dev/test/build のプロセスをそのまま引き継いで走るため、S3 を無効にした
    // ローカル環境では s3Storage が注入する media.prefix を欠いた型を書き戻してしまう。
    // 生成は常にダミーの S3 設定を与える pnpm generate:types からのみ行う
    autoGenerate: false,
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
