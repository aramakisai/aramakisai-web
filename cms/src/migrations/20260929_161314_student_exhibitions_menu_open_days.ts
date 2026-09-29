import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "student_exhibitions_vendor_menu" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"price" varchar
  );
  
  CREATE TABLE "student_exhibitions_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "student_exhibitions_vendor_menu" ADD CONSTRAINT "student_exhibitions_vendor_menu_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."student_exhibitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "student_exhibitions_texts" ADD CONSTRAINT "student_exhibitions_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."student_exhibitions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "student_exhibitions_vendor_menu_order_idx" ON "student_exhibitions_vendor_menu" USING btree ("_order");
  CREATE INDEX "student_exhibitions_vendor_menu_parent_id_idx" ON "student_exhibitions_vendor_menu" USING btree ("_parent_id");
  CREATE INDEX "student_exhibitions_texts_order_parent" ON "student_exhibitions_texts" USING btree ("order","parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "student_exhibitions_vendor_menu" CASCADE;
  DROP TABLE "student_exhibitions_texts" CASCADE;`)
}
