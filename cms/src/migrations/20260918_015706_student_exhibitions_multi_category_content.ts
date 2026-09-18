import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_student_exhibitions_categories" AS ENUM('stage', 'exhibit', 'vendor', 'other');
  CREATE TABLE "student_exhibitions_categories" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_student_exhibitions_categories",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  DROP TABLE "student_exhibitions_category" CASCADE;
  ALTER TABLE "student_exhibitions" ADD COLUMN "stage_description" varchar;
  ALTER TABLE "student_exhibitions" ADD COLUMN "exhibit_name" varchar;
  ALTER TABLE "student_exhibitions" ADD COLUMN "exhibit_description" varchar;
  ALTER TABLE "student_exhibitions" ADD COLUMN "vendor_name" varchar;
  ALTER TABLE "student_exhibitions" ADD COLUMN "vendor_description" varchar;
  ALTER TABLE "student_exhibitions" ADD COLUMN "other_name" varchar;
  ALTER TABLE "student_exhibitions" ADD COLUMN "other_description" varchar;
  ALTER TABLE "student_exhibitions_categories" ADD CONSTRAINT "student_exhibitions_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."student_exhibitions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "student_exhibitions_categories_order_idx" ON "student_exhibitions_categories" USING btree ("order");
  CREATE INDEX "student_exhibitions_categories_parent_idx" ON "student_exhibitions_categories" USING btree ("parent_id");
  ALTER TABLE "student_exhibitions" DROP COLUMN "name";
  ALTER TABLE "student_exhibitions" DROP COLUMN "description";
  DROP TYPE "public"."enum_student_exhibitions_category";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_student_exhibitions_category" AS ENUM('stage', 'exhibit', 'vendor', 'other');
  CREATE TABLE "student_exhibitions_category" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_student_exhibitions_category",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  DROP TABLE "student_exhibitions_categories" CASCADE;
  ALTER TABLE "student_exhibitions" ADD COLUMN "name" varchar NOT NULL;
  ALTER TABLE "student_exhibitions" ADD COLUMN "description" varchar;
  ALTER TABLE "student_exhibitions_category" ADD CONSTRAINT "student_exhibitions_category_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."student_exhibitions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "student_exhibitions_category_order_idx" ON "student_exhibitions_category" USING btree ("order");
  CREATE INDEX "student_exhibitions_category_parent_idx" ON "student_exhibitions_category" USING btree ("parent_id");
  ALTER TABLE "student_exhibitions" DROP COLUMN "stage_description";
  ALTER TABLE "student_exhibitions" DROP COLUMN "exhibit_name";
  ALTER TABLE "student_exhibitions" DROP COLUMN "exhibit_description";
  ALTER TABLE "student_exhibitions" DROP COLUMN "vendor_name";
  ALTER TABLE "student_exhibitions" DROP COLUMN "vendor_description";
  ALTER TABLE "student_exhibitions" DROP COLUMN "other_name";
  ALTER TABLE "student_exhibitions" DROP COLUMN "other_description";
  DROP TYPE "public"."enum_student_exhibitions_categories";`)
}
