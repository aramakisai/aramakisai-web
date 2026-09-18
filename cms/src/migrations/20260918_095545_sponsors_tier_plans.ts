import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sponsors" ALTER COLUMN "tier" SET DATA TYPE text;
  DROP TYPE "public"."enum_sponsors_tier";
  CREATE TYPE "public"."enum_sponsors_tier" AS ENUM('planA', 'planB', 'planC', 'planD');
  ALTER TABLE "sponsors" ALTER COLUMN "tier" SET DATA TYPE "public"."enum_sponsors_tier" USING "tier"::"public"."enum_sponsors_tier";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sponsors" ALTER COLUMN "tier" SET DATA TYPE text;
  DROP TYPE "public"."enum_sponsors_tier";
  CREATE TYPE "public"."enum_sponsors_tier" AS ENUM('platinum', 'gold', 'silver', 'bronze');
  ALTER TABLE "sponsors" ALTER COLUMN "tier" SET DATA TYPE "public"."enum_sponsors_tier" USING "tier"::"public"."enum_sponsors_tier";`)
}
