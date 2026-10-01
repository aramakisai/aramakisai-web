import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "student_exhibitions_area_booth_unique";
   ALTER TABLE "student_exhibitions" DROP CONSTRAINT "student_exhibitions_area_id_id_map_areas_id_fk";
  
  DROP INDEX "student_exhibitions_area_id_idx";
  ALTER TABLE "student_exhibitions" ADD COLUMN "exhibit_area_id_id" integer;
  ALTER TABLE "student_exhibitions" ADD COLUMN "exhibit_booth_number" numeric;
  ALTER TABLE "student_exhibitions" ADD COLUMN "exhibit_booth_label" varchar;
  ALTER TABLE "student_exhibitions" ADD COLUMN "vendor_area_id_id" integer;
  ALTER TABLE "student_exhibitions" ADD COLUMN "vendor_booth_number" numeric;
  ALTER TABLE "student_exhibitions" ADD COLUMN "vendor_booth_label" varchar;
  ALTER TABLE "student_exhibitions" ADD COLUMN "other_area_id_id" integer;
  ALTER TABLE "student_exhibitions" ADD COLUMN "other_booth_number" numeric;
  ALTER TABLE "student_exhibitions" ADD COLUMN "other_booth_label" varchar;
  ALTER TABLE "student_exhibitions" ADD CONSTRAINT "student_exhibitions_exhibit_area_id_id_map_areas_id_fk" FOREIGN KEY ("exhibit_area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "student_exhibitions" ADD CONSTRAINT "student_exhibitions_vendor_area_id_id_map_areas_id_fk" FOREIGN KEY ("vendor_area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "student_exhibitions" ADD CONSTRAINT "student_exhibitions_other_area_id_id_map_areas_id_fk" FOREIGN KEY ("other_area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "student_exhibitions_exhibit_exhibit_area_id_idx" ON "student_exhibitions" USING btree ("exhibit_area_id_id");
  CREATE INDEX "student_exhibitions_vendor_vendor_area_id_idx" ON "student_exhibitions" USING btree ("vendor_area_id_id");
  CREATE INDEX "student_exhibitions_other_other_area_id_idx" ON "student_exhibitions" USING btree ("other_area_id_id");
  ALTER TABLE "student_exhibitions" DROP COLUMN "area_id_id";
  ALTER TABLE "student_exhibitions" DROP COLUMN "booth_number";
  ALTER TABLE "student_exhibitions" DROP COLUMN "booth_label";
  CREATE UNIQUE INDEX "student_exhibitions_exhibit_area_booth_unique" ON "student_exhibitions" ("exhibit_area_id_id", "exhibit_booth_number") WHERE "exhibit_area_id_id" IS NOT NULL AND "exhibit_booth_number" IS NOT NULL;
  CREATE UNIQUE INDEX "student_exhibitions_vendor_area_booth_unique" ON "student_exhibitions" ("vendor_area_id_id", "vendor_booth_number") WHERE "vendor_area_id_id" IS NOT NULL AND "vendor_booth_number" IS NOT NULL;
  CREATE UNIQUE INDEX "student_exhibitions_other_area_booth_unique" ON "student_exhibitions" ("other_area_id_id", "other_booth_number") WHERE "other_area_id_id" IS NOT NULL AND "other_booth_number" IS NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "student_exhibitions_exhibit_area_booth_unique";
  DROP INDEX IF EXISTS "student_exhibitions_vendor_area_booth_unique";
  DROP INDEX IF EXISTS "student_exhibitions_other_area_booth_unique";
   ALTER TABLE "student_exhibitions" DROP CONSTRAINT "student_exhibitions_exhibit_area_id_id_map_areas_id_fk";
  
  ALTER TABLE "student_exhibitions" DROP CONSTRAINT "student_exhibitions_vendor_area_id_id_map_areas_id_fk";
  
  ALTER TABLE "student_exhibitions" DROP CONSTRAINT "student_exhibitions_other_area_id_id_map_areas_id_fk";
  
  DROP INDEX "student_exhibitions_exhibit_exhibit_area_id_idx";
  DROP INDEX "student_exhibitions_vendor_vendor_area_id_idx";
  DROP INDEX "student_exhibitions_other_other_area_id_idx";
  ALTER TABLE "student_exhibitions" ADD COLUMN "area_id_id" integer;
  ALTER TABLE "student_exhibitions" ADD COLUMN "booth_number" numeric;
  ALTER TABLE "student_exhibitions" ADD COLUMN "booth_label" varchar;
  ALTER TABLE "student_exhibitions" ADD CONSTRAINT "student_exhibitions_area_id_id_map_areas_id_fk" FOREIGN KEY ("area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "student_exhibitions_area_id_idx" ON "student_exhibitions" USING btree ("area_id_id");
  ALTER TABLE "student_exhibitions" DROP COLUMN "exhibit_area_id_id";
  ALTER TABLE "student_exhibitions" DROP COLUMN "exhibit_booth_number";
  ALTER TABLE "student_exhibitions" DROP COLUMN "exhibit_booth_label";
  ALTER TABLE "student_exhibitions" DROP COLUMN "vendor_area_id_id";
  ALTER TABLE "student_exhibitions" DROP COLUMN "vendor_booth_number";
  ALTER TABLE "student_exhibitions" DROP COLUMN "vendor_booth_label";
  ALTER TABLE "student_exhibitions" DROP COLUMN "other_area_id_id";
  ALTER TABLE "student_exhibitions" DROP COLUMN "other_booth_number";
  ALTER TABLE "student_exhibitions" DROP COLUMN "other_booth_label";
  CREATE UNIQUE INDEX "student_exhibitions_area_booth_unique" ON "student_exhibitions" ("area_id_id", "booth_number") WHERE "area_id_id" IS NOT NULL AND "booth_number" IS NOT NULL;`)
}
