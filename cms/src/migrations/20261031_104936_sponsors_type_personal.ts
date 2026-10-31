import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_sponsors_type" ADD VALUE 'personal';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sponsors_type" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_sponsors_type";
  CREATE TYPE "public"."enum_sponsors_type" AS ENUM('ad', 'local', 'vendor', 'other');
  ALTER TABLE "sponsors_type" ALTER COLUMN "value" SET DATA TYPE "public"."enum_sponsors_type" USING "value"::"public"."enum_sponsors_type";`)
}
