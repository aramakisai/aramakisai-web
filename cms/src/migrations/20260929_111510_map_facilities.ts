import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_map_points_kind" AS ENUM('garbage_station', 'reception');
  CREATE TABLE "map_points" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_map_points_kind" NOT NULL,
  	"latitude" numeric NOT NULL,
  	"longitude" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "map_areas" ADD COLUMN "has_aed" boolean DEFAULT false;
  ALTER TABLE "map_areas" ADD COLUMN "has_toilet" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "map_points_id" integer;
  CREATE INDEX "map_points_updated_at_idx" ON "map_points" USING btree ("updated_at");
  CREATE INDEX "map_points_created_at_idx" ON "map_points" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_map_points_fk" FOREIGN KEY ("map_points_id") REFERENCES "public"."map_points"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_map_points_id_idx" ON "payload_locked_documents_rels" USING btree ("map_points_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "map_points" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "map_points" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_map_points_fk";
  
  DROP INDEX "payload_locked_documents_rels_map_points_id_idx";
  ALTER TABLE "map_areas" DROP COLUMN "has_aed";
  ALTER TABLE "map_areas" DROP COLUMN "has_toilet";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "map_points_id";
  DROP TYPE "public"."enum_map_points_kind";`)
}
