import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sponsors_local_map_category" AS ENUM('hospital', 'life', 'car', 'education', 'food', 'shop');
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_filename" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "local_import_id" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "local_map_category" "enum_sponsors_local_map_category";
  ALTER TABLE "sponsors" ADD COLUMN "local_latitude" numeric;
  ALTER TABLE "sponsors" ADD COLUMN "local_longitude" numeric;
  ALTER TABLE "sponsors" ADD COLUMN "local_image_id" integer;
  ALTER TABLE "sponsors" ADD COLUMN "local_image_alt" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "local_image_decorative" boolean DEFAULT false;
  ALTER TABLE "sponsors" ADD COLUMN "local_business_hours" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "local_closed_days" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "local_phone" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "local_image_checksum" varchar;
  ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_local_image_id_media_id_fk" FOREIGN KEY ("local_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_local_latitude_check" CHECK ("local_latitude" IS NULL OR "local_latitude" BETWEEN -90 AND 90);
  ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_local_longitude_check" CHECK ("local_longitude" IS NULL OR "local_longitude" BETWEEN -180 AND 180);
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE UNIQUE INDEX "sponsors_local_import_id_idx" ON "sponsors" USING btree ("local_import_id");
  CREATE INDEX "sponsors_local_image_idx" ON "sponsors" USING btree ("local_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sponsors" DROP CONSTRAINT "sponsors_local_image_id_media_id_fk";
  ALTER TABLE "sponsors" DROP CONSTRAINT "sponsors_local_latitude_check";
  ALTER TABLE "sponsors" DROP CONSTRAINT "sponsors_local_longitude_check";
  
  DROP INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx";
  DROP INDEX "sponsors_local_import_id_idx";
  DROP INDEX "sponsors_local_image_idx";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_url";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_width";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_height";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_filename";
  ALTER TABLE "sponsors" DROP COLUMN "local_import_id";
  ALTER TABLE "sponsors" DROP COLUMN "local_map_category";
  ALTER TABLE "sponsors" DROP COLUMN "local_latitude";
  ALTER TABLE "sponsors" DROP COLUMN "local_longitude";
  ALTER TABLE "sponsors" DROP COLUMN "local_image_id";
  ALTER TABLE "sponsors" DROP COLUMN "local_image_alt";
  ALTER TABLE "sponsors" DROP COLUMN "local_image_decorative";
  ALTER TABLE "sponsors" DROP COLUMN "local_business_hours";
  ALTER TABLE "sponsors" DROP COLUMN "local_closed_days";
  ALTER TABLE "sponsors" DROP COLUMN "local_phone";
  ALTER TABLE "sponsors" DROP COLUMN "local_image_checksum";
  DROP TYPE "public"."enum_sponsors_local_map_category";`)
}
