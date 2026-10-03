import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_parking_statuses_status" AS ENUM('available', 'crowded', 'full');
  CREATE TABLE "parking_lots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"sort" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "parking_statuses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"lot_id" integer NOT NULL,
  	"status" "enum_parking_statuses_status" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "parking_lots_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "parking_statuses_id" integer;
  ALTER TABLE "festival_meta" ADD COLUMN "parking_enabled" boolean DEFAULT false;
  ALTER TABLE "parking_statuses" ADD CONSTRAINT "parking_statuses_lot_id_parking_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."parking_lots"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "parking_lots_updated_at_idx" ON "parking_lots" USING btree ("updated_at");
  CREATE INDEX "parking_lots_created_at_idx" ON "parking_lots" USING btree ("created_at");
  CREATE UNIQUE INDEX "parking_statuses_lot_idx" ON "parking_statuses" USING btree ("lot_id");
  CREATE INDEX "parking_statuses_updated_at_idx" ON "parking_statuses" USING btree ("updated_at");
  CREATE INDEX "parking_statuses_created_at_idx" ON "parking_statuses" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parking_lots_fk" FOREIGN KEY ("parking_lots_id") REFERENCES "public"."parking_lots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parking_statuses_fk" FOREIGN KEY ("parking_statuses_id") REFERENCES "public"."parking_statuses"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_parking_lots_id_idx" ON "payload_locked_documents_rels" USING btree ("parking_lots_id");
  CREATE INDEX "payload_locked_documents_rels_parking_statuses_id_idx" ON "payload_locked_documents_rels" USING btree ("parking_statuses_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "parking_lots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "parking_statuses" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "parking_lots" CASCADE;
  DROP TABLE "parking_statuses" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_parking_lots_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_parking_statuses_fk";
  
  DROP INDEX "payload_locked_documents_rels_parking_lots_id_idx";
  DROP INDEX "payload_locked_documents_rels_parking_statuses_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "parking_lots_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "parking_statuses_id";
  ALTER TABLE "festival_meta" DROP COLUMN "parking_enabled";
  DROP TYPE "public"."enum_parking_statuses_status";`)
}
