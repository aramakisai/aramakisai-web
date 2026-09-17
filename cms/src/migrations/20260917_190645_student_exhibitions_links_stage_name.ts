import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_student_exhibitions_links_platform" AS ENUM('x', 'instagram', 'facebook', 'youtube', 'tiktok', 'line', 'website');
  CREATE TABLE "student_exhibitions_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_student_exhibitions_links_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  ALTER TABLE "student_exhibitions" ADD COLUMN "stage_name" varchar;
  ALTER TABLE "student_exhibitions_links" ADD CONSTRAINT "student_exhibitions_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."student_exhibitions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "student_exhibitions_links_order_idx" ON "student_exhibitions_links" USING btree ("_order");
  CREATE INDEX "student_exhibitions_links_parent_id_idx" ON "student_exhibitions_links" USING btree ("_parent_id");
  ALTER TABLE "student_exhibitions" DROP COLUMN "links";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "student_exhibitions_links" CASCADE;
  ALTER TABLE "student_exhibitions" ADD COLUMN "links" jsonb;
  ALTER TABLE "student_exhibitions" DROP COLUMN "stage_name";
  DROP TYPE "public"."enum_student_exhibitions_links_platform";`)
}
