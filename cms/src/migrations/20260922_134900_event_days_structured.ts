import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "festival_meta_event_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_at" timestamp(3) with time zone NOT NULL,
  	"end_at" timestamp(3) with time zone NOT NULL,
  	"label" varchar
  );
  
  ALTER TABLE "festival_meta_event_days" ADD CONSTRAINT "festival_meta_event_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."festival_meta"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "festival_meta_event_days_order_idx" ON "festival_meta_event_days" USING btree ("_order");
  CREATE INDEX "festival_meta_event_days_parent_id_idx" ON "festival_meta_event_days" USING btree ("_parent_id");
  ALTER TABLE "festival_meta" DROP COLUMN "event_days";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "festival_meta_event_days" CASCADE;
  ALTER TABLE "festival_meta" ADD COLUMN "event_days" jsonb;`)
}
