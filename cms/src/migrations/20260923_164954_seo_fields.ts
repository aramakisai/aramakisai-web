import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "announcements" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "announcements" ADD COLUMN "og_image_id" integer;
  ALTER TABLE "topics" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "pages" ADD COLUMN "og_image_id" integer;
  ALTER TABLE "festival_meta" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "festival_meta" ADD COLUMN "og_image_id" integer;
  ALTER TABLE "festival_meta" ADD COLUMN "venue_address" varchar;
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festival_meta" ADD CONSTRAINT "festival_meta_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "announcements_og_image_idx" ON "announcements" USING btree ("og_image_id");
  CREATE INDEX "pages_og_image_idx" ON "pages" USING btree ("og_image_id");
  CREATE INDEX "festival_meta_og_image_idx" ON "festival_meta" USING btree ("og_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "announcements" DROP CONSTRAINT "announcements_og_image_id_media_id_fk";
  
  ALTER TABLE "pages" DROP CONSTRAINT "pages_og_image_id_media_id_fk";
  
  ALTER TABLE "festival_meta" DROP CONSTRAINT "festival_meta_og_image_id_media_id_fk";
  
  DROP INDEX "announcements_og_image_idx";
  DROP INDEX "pages_og_image_idx";
  DROP INDEX "festival_meta_og_image_idx";
  ALTER TABLE "announcements" DROP COLUMN "meta_description";
  ALTER TABLE "announcements" DROP COLUMN "og_image_id";
  ALTER TABLE "topics" DROP COLUMN "meta_description";
  ALTER TABLE "pages" DROP COLUMN "meta_description";
  ALTER TABLE "pages" DROP COLUMN "og_image_id";
  ALTER TABLE "festival_meta" DROP COLUMN "meta_description";
  ALTER TABLE "festival_meta" DROP COLUMN "og_image_id";
  ALTER TABLE "festival_meta" DROP COLUMN "venue_address";`)
}
