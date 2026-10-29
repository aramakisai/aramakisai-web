import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "sponsors_area_booth_unique";
   CREATE TABLE "sponsors_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "sponsors_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "sponsors" DROP CONSTRAINT "sponsors_area_id_id_map_areas_id_fk";
  
  DROP INDEX "sponsors_area_id_idx";
  ALTER TABLE "sponsors" ADD COLUMN "vendor_name" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "vendor_description" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "vendor_area_id_id" integer;
  ALTER TABLE "sponsors" ADD COLUMN "vendor_booth_number" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "vendor_booth_label" varchar;
  ALTER TABLE "sponsors_texts" ADD CONSTRAINT "sponsors_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sponsors_rels" ADD CONSTRAINT "sponsors_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sponsors_rels" ADD CONSTRAINT "sponsors_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "sponsors_texts_order_parent" ON "sponsors_texts" USING btree ("order","parent_id");
  CREATE INDEX "sponsors_rels_order_idx" ON "sponsors_rels" USING btree ("order");
  CREATE INDEX "sponsors_rels_parent_idx" ON "sponsors_rels" USING btree ("parent_id");
  CREATE INDEX "sponsors_rels_path_idx" ON "sponsors_rels" USING btree ("path");
  CREATE INDEX "sponsors_rels_media_id_idx" ON "sponsors_rels" USING btree ("media_id");
  ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_vendor_area_id_id_map_areas_id_fk" FOREIGN KEY ("vendor_area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "sponsors_vendor_vendor_area_id_idx" ON "sponsors" USING btree ("vendor_area_id_id");
  ALTER TABLE "sponsors" DROP COLUMN "area_id_id";
  ALTER TABLE "sponsors" DROP COLUMN "booth_number";
  ALTER TABLE "sponsors" DROP COLUMN "booth_label";
  CREATE UNIQUE INDEX "sponsors_vendor_area_booth_unique" ON "sponsors" ("vendor_area_id_id", "vendor_booth_number") WHERE "vendor_area_id_id" IS NOT NULL AND "vendor_booth_number" IS NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "sponsors_vendor_area_booth_unique";
   ALTER TABLE "sponsors_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sponsors_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "sponsors_texts" CASCADE;
  DROP TABLE "sponsors_rels" CASCADE;
  ALTER TABLE "sponsors" DROP CONSTRAINT "sponsors_vendor_area_id_id_map_areas_id_fk";
  
  DROP INDEX "sponsors_vendor_vendor_area_id_idx";
  ALTER TABLE "sponsors" ADD COLUMN "area_id_id" integer;
  ALTER TABLE "sponsors" ADD COLUMN "booth_number" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "booth_label" varchar;
  ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_area_id_id_map_areas_id_fk" FOREIGN KEY ("area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "sponsors_area_id_idx" ON "sponsors" USING btree ("area_id_id");
  ALTER TABLE "sponsors" DROP COLUMN "vendor_name";
  ALTER TABLE "sponsors" DROP COLUMN "vendor_description";
  ALTER TABLE "sponsors" DROP COLUMN "vendor_area_id_id";
  ALTER TABLE "sponsors" DROP COLUMN "vendor_booth_number";
  ALTER TABLE "sponsors" DROP COLUMN "vendor_booth_label";
  CREATE UNIQUE INDEX "sponsors_area_booth_unique" ON "sponsors" ("area_id_id", "booth_number") WHERE "area_id_id" IS NOT NULL AND "booth_number" IS NOT NULL;`)
}
