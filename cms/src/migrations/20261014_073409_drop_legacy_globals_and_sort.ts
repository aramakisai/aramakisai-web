import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "festival_meta_event_days" CASCADE;
  DROP TABLE "festival_meta" CASCADE;
  DROP TABLE "page_home" CASCADE;
  DROP TABLE "page_home_rels" CASCADE;
  ALTER TABLE "topics" DROP COLUMN "sort";
  ALTER TABLE "pages" DROP COLUMN "sort";
  ALTER TABLE "sponsors" DROP COLUMN "sort";
  ALTER TABLE "faq_items" DROP COLUMN "sort";
  ALTER TABLE "map_areas" DROP COLUMN "sort";
  ALTER TABLE "stages" DROP COLUMN "sort";
  ALTER TABLE "parking_lots" DROP COLUMN "sort";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "festival_meta_event_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_at" timestamp(3) with time zone NOT NULL,
  	"end_at" timestamp(3) with time zone NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "festival_meta" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"parking_map_id" integer,
  	"sns_links" jsonb,
  	"overview" jsonb,
  	"overview_html" varchar,
  	"hero_image_id" integer,
  	"theme_word" varchar,
  	"theme_description" jsonb,
  	"theme_description_html" varchar,
  	"venue_name" varchar,
  	"campus_map_url" varchar,
  	"contact_form_url" varchar,
  	"theme_image_id" integer,
  	"site_title" varchar,
  	"access_summary" varchar,
  	"meta_description" varchar,
  	"og_image_id" integer,
  	"venue_address" varchar,
  	"exhibitor_contact_url" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "page_home" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_message" jsonb,
  	"hero_message_html" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "page_home_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "topics" ADD COLUMN "sort" numeric;
  ALTER TABLE "pages" ADD COLUMN "sort" numeric;
  ALTER TABLE "sponsors" ADD COLUMN "sort" numeric;
  ALTER TABLE "faq_items" ADD COLUMN "sort" numeric;
  ALTER TABLE "map_areas" ADD COLUMN "sort" numeric;
  ALTER TABLE "stages" ADD COLUMN "sort" numeric;
  ALTER TABLE "parking_lots" ADD COLUMN "sort" numeric;
  ALTER TABLE "festival_meta_event_days" ADD CONSTRAINT "festival_meta_event_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."festival_meta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "festival_meta" ADD CONSTRAINT "festival_meta_parking_map_id_media_id_fk" FOREIGN KEY ("parking_map_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festival_meta" ADD CONSTRAINT "festival_meta_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festival_meta" ADD CONSTRAINT "festival_meta_theme_image_id_media_id_fk" FOREIGN KEY ("theme_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festival_meta" ADD CONSTRAINT "festival_meta_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "page_home_rels" ADD CONSTRAINT "page_home_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home_rels" ADD CONSTRAINT "page_home_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "festival_meta_event_days_order_idx" ON "festival_meta_event_days" USING btree ("_order");
  CREATE INDEX "festival_meta_event_days_parent_id_idx" ON "festival_meta_event_days" USING btree ("_parent_id");
  CREATE INDEX "festival_meta_parking_map_idx" ON "festival_meta" USING btree ("parking_map_id");
  CREATE INDEX "festival_meta_hero_image_idx" ON "festival_meta" USING btree ("hero_image_id");
  CREATE INDEX "festival_meta_theme_image_idx" ON "festival_meta" USING btree ("theme_image_id");
  CREATE INDEX "festival_meta_og_image_idx" ON "festival_meta" USING btree ("og_image_id");
  CREATE INDEX "page_home_rels_order_idx" ON "page_home_rels" USING btree ("order");
  CREATE INDEX "page_home_rels_parent_idx" ON "page_home_rels" USING btree ("parent_id");
  CREATE INDEX "page_home_rels_path_idx" ON "page_home_rels" USING btree ("path");
  CREATE INDEX "page_home_rels_media_id_idx" ON "page_home_rels" USING btree ("media_id");`)
}
