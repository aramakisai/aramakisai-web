import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "personal_sponsors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_order" varchar,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "personal_sponsors_id" integer;
  CREATE INDEX "personal_sponsors__order_idx" ON "personal_sponsors" USING btree ("_order");
  CREATE INDEX "personal_sponsors_updated_at_idx" ON "personal_sponsors" USING btree ("updated_at");
  CREATE INDEX "personal_sponsors_created_at_idx" ON "personal_sponsors" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_personal_sponsors_fk" FOREIGN KEY ("personal_sponsors_id") REFERENCES "public"."personal_sponsors"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_personal_sponsors_id_idx" ON "payload_locked_documents_rels" USING btree ("personal_sponsors_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_personal_sponsors_fk";
  DROP INDEX "payload_locked_documents_rels_personal_sponsors_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "personal_sponsors_id";
  DROP TABLE "personal_sponsors";`)
}
