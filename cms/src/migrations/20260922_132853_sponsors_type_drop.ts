import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sponsors" DROP COLUMN "type";
  DROP TYPE "public"."enum_sponsors_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sponsors_type" AS ENUM('ad', 'sponsor', 'food_truck', 'other');
  ALTER TABLE "sponsors" ADD COLUMN "type" "enum_sponsors_type" DEFAULT 'sponsor' NOT NULL;`)
}
