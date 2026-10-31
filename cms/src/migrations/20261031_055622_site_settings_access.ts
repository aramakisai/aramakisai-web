import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

const ACCESS_SUMMARY =
  'JR前橋駅北口2番乗り場から関越交通バスで約28分、「群馬大学荒牧」下車。お車の場合は開催中の臨時駐車場をご利用いただけますが、混雑状況によってはご用意できない場合があります。できる限り公共交通機関をご利用ください。'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "access_summary" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "access_content" jsonb;
  ALTER TABLE "site_settings" ADD COLUMN "access_content_html" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "access_embed_url" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "access_embed_height" numeric;`)

  await db.execute(sql`UPDATE "site_settings" SET "access_summary" = ${ACCESS_SUMMARY}`)
  await db.execute(sql`
  UPDATE "site_settings" s SET
    "access_content" = p."content",
    "access_content_html" = p."content_html",
    "access_embed_url" = p."embed_url",
    "access_embed_height" = p."embed_height"
  FROM "pages" p WHERE p."slug" = 'access';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "access_summary";
  ALTER TABLE "site_settings" DROP COLUMN "access_content";
  ALTER TABLE "site_settings" DROP COLUMN "access_content_html";
  ALTER TABLE "site_settings" DROP COLUMN "access_embed_url";
  ALTER TABLE "site_settings" DROP COLUMN "access_embed_height";`)
}
