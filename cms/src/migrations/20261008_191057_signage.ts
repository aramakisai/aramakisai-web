import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_signage_slides_kind" AS ENUM('sponsors', 'lost_items', 'campus_map', 'image', 'parking', 'timetable', 'layout');
  CREATE TYPE "public"."enum_signage_slides_layout" AS ENUM('title', 'title-content', 'section', 'two-content');
  CREATE TYPE "public"."enum_signage_slides_tone" AS ENUM('normal', 'alert');
  CREATE TYPE "public"."enum_telops_audience" AS ENUM('visitor', 'group');
  CREATE TABLE "signage_slides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_order" varchar,
  	"kind" "enum_signage_slides_kind" NOT NULL,
  	"title" varchar NOT NULL,
  	"layout" "enum_signage_slides_layout",
  	"tone" "enum_signage_slides_tone" DEFAULT 'normal',
  	"subtext" varchar,
  	"content1" jsonb,
  	"content1_html" varchar,
  	"content2" jsonb,
  	"content2_html" varchar,
  	"image_id" integer,
  	"duration_seconds" numeric DEFAULT 10 NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"pinned" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "telops" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_order" varchar,
  	"audience" "enum_telops_audience" DEFAULT 'visitor' NOT NULL,
  	"target" varchar,
  	"body" varchar NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lost_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"found_place" varchar NOT NULL,
  	"found_at" timestamp(3) with time zone NOT NULL,
  	"photo_id" integer,
  	"returned" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "signage_slides_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "telops_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lost_items_id" integer;
  ALTER TABLE "signage_slides" ADD CONSTRAINT "signage_slides_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lost_items" ADD CONSTRAINT "lost_items_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "signage_slides__order_idx" ON "signage_slides" USING btree ("_order");
  CREATE INDEX "signage_slides_image_idx" ON "signage_slides" USING btree ("image_id");
  CREATE INDEX "signage_slides_updated_at_idx" ON "signage_slides" USING btree ("updated_at");
  CREATE INDEX "signage_slides_created_at_idx" ON "signage_slides" USING btree ("created_at");
  CREATE INDEX "telops__order_idx" ON "telops" USING btree ("_order");
  CREATE INDEX "telops_updated_at_idx" ON "telops" USING btree ("updated_at");
  CREATE INDEX "telops_created_at_idx" ON "telops" USING btree ("created_at");
  CREATE INDEX "lost_items_photo_idx" ON "lost_items" USING btree ("photo_id");
  CREATE INDEX "lost_items_updated_at_idx" ON "lost_items" USING btree ("updated_at");
  CREATE INDEX "lost_items_created_at_idx" ON "lost_items" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_signage_slides_fk" FOREIGN KEY ("signage_slides_id") REFERENCES "public"."signage_slides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_telops_fk" FOREIGN KEY ("telops_id") REFERENCES "public"."telops"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lost_items_fk" FOREIGN KEY ("lost_items_id") REFERENCES "public"."lost_items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_signage_slides_id_idx" ON "payload_locked_documents_rels" USING btree ("signage_slides_id");
  CREATE INDEX "payload_locked_documents_rels_telops_id_idx" ON "payload_locked_documents_rels" USING btree ("telops_id");
  CREATE INDEX "payload_locked_documents_rels_lost_items_id_idx" ON "payload_locked_documents_rels" USING btree ("lost_items_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "signage_slides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "telops" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lost_items" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "signage_slides" CASCADE;
  DROP TABLE "telops" CASCADE;
  DROP TABLE "lost_items" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_signage_slides_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_telops_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_lost_items_fk";
  
  DROP INDEX "payload_locked_documents_rels_signage_slides_id_idx";
  DROP INDEX "payload_locked_documents_rels_telops_id_idx";
  DROP INDEX "payload_locked_documents_rels_lost_items_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "signage_slides_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "telops_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "lost_items_id";
  DROP TYPE "public"."enum_signage_slides_kind";
  DROP TYPE "public"."enum_signage_slides_layout";
  DROP TYPE "public"."enum_signage_slides_tone";
  DROP TYPE "public"."enum_telops_audience";`)
}
