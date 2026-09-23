import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sponsors_type" AS ENUM('ad', 'local', 'vendor', 'other');
  CREATE TABLE "sponsors_type" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_sponsors_type",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "sponsors_type" ADD CONSTRAINT "sponsors_type_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "sponsors_type_order_idx" ON "sponsors_type" USING btree ("order");
  CREATE INDEX "sponsors_type_parent_idx" ON "sponsors_type" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "sponsors_type" CASCADE;
  DROP TYPE "public"."enum_sponsors_type";`)
}
