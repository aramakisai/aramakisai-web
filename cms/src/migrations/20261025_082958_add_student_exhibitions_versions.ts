import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum__student_exhibitions_v_version_categories" AS ENUM('stage', 'exhibit', 'vendor', 'other');
  CREATE TYPE "public"."enum__student_exhibitions_v_version_links_platform" AS ENUM('x', 'instagram', 'facebook', 'youtube', 'tiktok', 'line', 'website');
  CREATE TYPE "public"."enum__student_exhibitions_v_version_status" AS ENUM('published', 'draft');
  CREATE TABLE "_student_exhibitions_v_version_categories" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__student_exhibitions_v_version_categories",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_student_exhibitions_v_version_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"platform" "enum__student_exhibitions_v_version_links_platform" NOT NULL,
  	"url" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_student_exhibitions_v_version_vendor_menu" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"price" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_student_exhibitions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_owner_id" integer NOT NULL,
  	"version_status" "enum__student_exhibitions_v_version_status" DEFAULT 'draft' NOT NULL,
  	"version_organization_name" varchar,
  	"version_stage_name" varchar,
  	"version_stage_description" varchar,
  	"version_exhibit_name" varchar,
  	"version_exhibit_description" varchar,
  	"version_exhibit_area_id_id" integer,
  	"version_exhibit_booth_number" varchar,
  	"version_exhibit_booth_label" varchar,
  	"version_vendor_name" varchar,
  	"version_vendor_description" varchar,
  	"version_vendor_area_id_id" integer,
  	"version_vendor_booth_number" varchar,
  	"version_vendor_booth_label" varchar,
  	"version_other_name" varchar,
  	"version_other_description" varchar,
  	"version_other_area_id_id" integer,
  	"version_other_booth_number" varchar,
  	"version_other_booth_label" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_student_exhibitions_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_student_exhibitions_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "_student_exhibitions_v_version_categories" ADD CONSTRAINT "_student_exhibitions_v_version_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_student_exhibitions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_student_exhibitions_v_version_links" ADD CONSTRAINT "_student_exhibitions_v_version_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_student_exhibitions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_student_exhibitions_v_version_vendor_menu" ADD CONSTRAINT "_student_exhibitions_v_version_vendor_menu_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_student_exhibitions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_student_exhibitions_v" ADD CONSTRAINT "_student_exhibitions_v_parent_id_student_exhibitions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."student_exhibitions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_student_exhibitions_v" ADD CONSTRAINT "_student_exhibitions_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_student_exhibitions_v" ADD CONSTRAINT "_student_exhibitions_v_version_exhibit_area_id_id_map_areas_id_fk" FOREIGN KEY ("version_exhibit_area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_student_exhibitions_v" ADD CONSTRAINT "_student_exhibitions_v_version_vendor_area_id_id_map_areas_id_fk" FOREIGN KEY ("version_vendor_area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_student_exhibitions_v" ADD CONSTRAINT "_student_exhibitions_v_version_other_area_id_id_map_areas_id_fk" FOREIGN KEY ("version_other_area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_student_exhibitions_v_texts" ADD CONSTRAINT "_student_exhibitions_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_student_exhibitions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_student_exhibitions_v_rels" ADD CONSTRAINT "_student_exhibitions_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_student_exhibitions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_student_exhibitions_v_rels" ADD CONSTRAINT "_student_exhibitions_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "_student_exhibitions_v_version_categories_order_idx" ON "_student_exhibitions_v_version_categories" USING btree ("order");
  CREATE INDEX "_student_exhibitions_v_version_categories_parent_idx" ON "_student_exhibitions_v_version_categories" USING btree ("parent_id");
  CREATE INDEX "_student_exhibitions_v_version_links_order_idx" ON "_student_exhibitions_v_version_links" USING btree ("_order");
  CREATE INDEX "_student_exhibitions_v_version_links_parent_id_idx" ON "_student_exhibitions_v_version_links" USING btree ("_parent_id");
  CREATE INDEX "_student_exhibitions_v_version_vendor_menu_order_idx" ON "_student_exhibitions_v_version_vendor_menu" USING btree ("_order");
  CREATE INDEX "_student_exhibitions_v_version_vendor_menu_parent_id_idx" ON "_student_exhibitions_v_version_vendor_menu" USING btree ("_parent_id");
  CREATE INDEX "_student_exhibitions_v_parent_idx" ON "_student_exhibitions_v" USING btree ("parent_id");
  CREATE INDEX "_student_exhibitions_v_version_version_owner_idx" ON "_student_exhibitions_v" USING btree ("version_owner_id");
  CREATE INDEX "_student_exhibitions_v_version_exhibit_version_exhibit_a_idx" ON "_student_exhibitions_v" USING btree ("version_exhibit_area_id_id");
  CREATE INDEX "_student_exhibitions_v_version_vendor_version_vendor_are_idx" ON "_student_exhibitions_v" USING btree ("version_vendor_area_id_id");
  CREATE INDEX "_student_exhibitions_v_version_other_version_other_area__idx" ON "_student_exhibitions_v" USING btree ("version_other_area_id_id");
  CREATE INDEX "_student_exhibitions_v_version_version_updated_at_idx" ON "_student_exhibitions_v" USING btree ("version_updated_at");
  CREATE INDEX "_student_exhibitions_v_version_version_created_at_idx" ON "_student_exhibitions_v" USING btree ("version_created_at");
  CREATE INDEX "_student_exhibitions_v_created_at_idx" ON "_student_exhibitions_v" USING btree ("created_at");
  CREATE INDEX "_student_exhibitions_v_updated_at_idx" ON "_student_exhibitions_v" USING btree ("updated_at");
  CREATE INDEX "_student_exhibitions_v_texts_order_parent" ON "_student_exhibitions_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_student_exhibitions_v_rels_order_idx" ON "_student_exhibitions_v_rels" USING btree ("order");
  CREATE INDEX "_student_exhibitions_v_rels_parent_idx" ON "_student_exhibitions_v_rels" USING btree ("parent_id");
  CREATE INDEX "_student_exhibitions_v_rels_path_idx" ON "_student_exhibitions_v_rels" USING btree ("path");
  CREATE INDEX "_student_exhibitions_v_rels_media_id_idx" ON "_student_exhibitions_v_rels" USING btree ("media_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "_student_exhibitions_v_version_categories" CASCADE;
  DROP TABLE "_student_exhibitions_v_version_links" CASCADE;
  DROP TABLE "_student_exhibitions_v_version_vendor_menu" CASCADE;
  DROP TABLE "_student_exhibitions_v" CASCADE;
  DROP TABLE "_student_exhibitions_v_texts" CASCADE;
  DROP TABLE "_student_exhibitions_v_rels" CASCADE;
  DROP TYPE "public"."enum__student_exhibitions_v_version_categories";
  DROP TYPE "public"."enum__student_exhibitions_v_version_links_platform";
  DROP TYPE "public"."enum__student_exhibitions_v_version_status";`)
}
