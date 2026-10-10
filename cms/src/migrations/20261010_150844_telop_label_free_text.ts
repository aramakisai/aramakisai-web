import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "telops" SET "target" = 'ご来場のみなさまへ' WHERE "target" IS NULL OR btrim("target") = '';
  ALTER TABLE "telops" ALTER COLUMN "target" SET DEFAULT 'ご来場のみなさまへ';
  ALTER TABLE "telops" ALTER COLUMN "target" SET NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "telops" ALTER COLUMN "target" DROP DEFAULT;
  ALTER TABLE "telops" ALTER COLUMN "target" DROP NOT NULL;`)
}
