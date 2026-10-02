import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_parking_lots_status" AS ENUM('available', 'crowded', 'full');
  CREATE TABLE "parking_lots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"status" "enum_parking_lots_status" NOT NULL,
  	"sort" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "parking_lots_id" integer;
  ALTER TABLE "festival_meta" ADD COLUMN "parking_enabled" boolean DEFAULT false;
  CREATE INDEX "parking_lots_updated_at_idx" ON "parking_lots" USING btree ("updated_at");
  CREATE INDEX "parking_lots_created_at_idx" ON "parking_lots" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parking_lots_fk" FOREIGN KEY ("parking_lots_id") REFERENCES "public"."parking_lots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_parking_lots_id_idx" ON "payload_locked_documents_rels" USING btree ("parking_lots_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "parking_lots" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "parking_lots" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_parking_lots_fk";
  
  DROP INDEX "payload_locked_documents_rels_parking_lots_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "parking_lots_id";
  ALTER TABLE "festival_meta" DROP COLUMN "parking_enabled";
  DROP TYPE "public"."enum_parking_lots_status";`)
}
