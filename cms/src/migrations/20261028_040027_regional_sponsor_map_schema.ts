import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sponsors_business_category" AS ENUM('hospital', 'life', 'car', 'education', 'food', 'shop');
  ALTER TABLE "sponsors" ALTER COLUMN "business_category" SET DATA TYPE "public"."enum_sponsors_business_category" USING "business_category"::"public"."enum_sponsors_business_category";
  ALTER TABLE "sponsors" ADD COLUMN "local_latitude" numeric;
  ALTER TABLE "sponsors" ADD COLUMN "local_longitude" numeric;
  ALTER TABLE "sponsors" ADD COLUMN "local_image_id" integer;
  ALTER TABLE "sponsors" ADD COLUMN "local_business_hours" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "local_phone" varchar;
  ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_local_image_id_media_id_fk" FOREIGN KEY ("local_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "sponsors_local_image_idx" ON "sponsors" USING btree ("local_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sponsors" DROP CONSTRAINT "sponsors_local_image_id_media_id_fk";
  
  DROP INDEX "sponsors_local_image_idx";
  ALTER TABLE "sponsors" ALTER COLUMN "business_category" SET DATA TYPE varchar;
  ALTER TABLE "sponsors" DROP COLUMN "local_latitude";
  ALTER TABLE "sponsors" DROP COLUMN "local_longitude";
  ALTER TABLE "sponsors" DROP COLUMN "local_image_id";
  ALTER TABLE "sponsors" DROP COLUMN "local_business_hours";
  ALTER TABLE "sponsors" DROP COLUMN "local_phone";
  DROP TYPE "public"."enum_sponsors_business_category";`)
}
