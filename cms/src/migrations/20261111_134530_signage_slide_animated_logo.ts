import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_signage_slides_layout" ADD VALUE 'logo';
  ALTER TABLE "signage_slides" ADD COLUMN "animated" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "signage_slides" ALTER COLUMN "layout" SET DATA TYPE text;
  DROP TYPE "public"."enum_signage_slides_layout";
  CREATE TYPE "public"."enum_signage_slides_layout" AS ENUM('title', 'title-content', 'section', 'two-content');
  ALTER TABLE "signage_slides" ALTER COLUMN "layout" SET DATA TYPE "public"."enum_signage_slides_layout" USING "layout"::"public"."enum_signage_slides_layout";
  ALTER TABLE "signage_slides" DROP COLUMN "animated";`)
}
