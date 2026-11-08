import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_map_points_reception_type" AS ENUM('general', 'comedy');
  ALTER TABLE "map_points" ADD COLUMN "reception_type" "enum_map_points_reception_type" DEFAULT 'general';
  ALTER TABLE "map_points" ADD COLUMN "poster_id" integer;
  ALTER TABLE "map_points" ADD COLUMN "event_topic_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "pamphlet_topic_id" integer;
  ALTER TABLE "map_points" ADD CONSTRAINT "map_points_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "map_points" ADD CONSTRAINT "map_points_event_topic_id_topics_id_fk" FOREIGN KEY ("event_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_pamphlet_topic_id_topics_id_fk" FOREIGN KEY ("pamphlet_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "map_points_poster_idx" ON "map_points" USING btree ("poster_id");
  CREATE INDEX "map_points_event_topic_idx" ON "map_points" USING btree ("event_topic_id");
  CREATE INDEX "site_settings_pamphlet_topic_idx" ON "site_settings" USING btree ("pamphlet_topic_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "map_points" DROP CONSTRAINT "map_points_poster_id_media_id_fk";
  
  ALTER TABLE "map_points" DROP CONSTRAINT "map_points_event_topic_id_topics_id_fk";
  
  ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_pamphlet_topic_id_topics_id_fk";
  
  DROP INDEX "map_points_poster_idx";
  DROP INDEX "map_points_event_topic_idx";
  DROP INDEX "site_settings_pamphlet_topic_idx";
  ALTER TABLE "map_points" DROP COLUMN "reception_type";
  ALTER TABLE "map_points" DROP COLUMN "poster_id";
  ALTER TABLE "map_points" DROP COLUMN "event_topic_id";
  ALTER TABLE "site_settings" DROP COLUMN "pamphlet_topic_id";
  DROP TYPE "public"."enum_map_points_reception_type";`)
}
