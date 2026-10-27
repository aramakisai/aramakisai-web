import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_parking_cameras_exposure_basis_quality" AS ENUM('ok', 'too_dark', 'too_bright', 'color_cast');
  CREATE TYPE "public"."enum_parking_snapshots_judge_status" AS ENUM('pending', 'succeeded', 'failed', 'skipped');
  CREATE TYPE "public"."enum_parking_snapshots_congestion" AS ENUM('available', 'crowded', 'full', 'unknown');
  CREATE TYPE "public"."enum_parking_snapshots_image_quality" AS ENUM('ok', 'too_dark', 'too_bright', 'color_cast');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'judgeParkingSnapshot';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'checkParkingCameras';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'judgeParkingSnapshot';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'checkParkingCameras';
  CREATE TABLE "parking_cameras" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"lot_id" integer,
  	"token_hash" varchar,
  	"token_issued_at" timestamp(3) with time zone,
  	"exposure_basis_quality" "enum_parking_cameras_exposure_basis_quality",
  	"exposure_basis_exposure" numeric,
  	"exposure_basis_captured_at" timestamp(3) with time zone,
  	"last_judged_window" numeric,
  	"last_captured_at" timestamp(3) with time zone,
  	"device_status_rssi" numeric,
  	"device_status_uptime" numeric,
  	"device_status_reset_reason" varchar,
  	"device_status_failures" numeric,
  	"device_status_firmware" varchar,
  	"device_status_received_at" timestamp(3) with time zone,
  	"outage_notified_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "parking_snapshots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"camera_id" integer NOT NULL,
  	"lot_id" integer,
  	"exposure" numeric,
  	"judge_status" "enum_parking_snapshots_judge_status",
  	"judge_error" varchar,
  	"congestion" "enum_parking_snapshots_congestion",
  	"image_quality" "enum_parking_snapshots_image_quality",
  	"judge_model" varchar,
  	"judged_at" timestamp(3) with time zone,
  	"captured_at" timestamp(3) with time zone NOT NULL,
  	"prefix" varchar DEFAULT 'payload-uploads/parking-snapshots',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_web_url" varchar,
  	"sizes_web_width" numeric,
  	"sizes_web_height" numeric,
  	"sizes_web_mime_type" varchar,
  	"sizes_web_filesize" numeric,
  	"sizes_web_filename" varchar
  );
  
  CREATE TABLE "payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_jobs" ADD COLUMN "meta" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "parking_cameras_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "parking_snapshots_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "parking_monitor_start" varchar DEFAULT '09:00';
  ALTER TABLE "site_settings" ADD COLUMN "parking_monitor_end" varchar DEFAULT '17:30';
  ALTER TABLE "parking_cameras" ADD CONSTRAINT "parking_cameras_lot_id_parking_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."parking_lots"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "parking_snapshots" ADD CONSTRAINT "parking_snapshots_camera_id_parking_cameras_id_fk" FOREIGN KEY ("camera_id") REFERENCES "public"."parking_cameras"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "parking_snapshots" ADD CONSTRAINT "parking_snapshots_lot_id_parking_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."parking_lots"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "parking_cameras_lot_idx" ON "parking_cameras" USING btree ("lot_id");
  CREATE UNIQUE INDEX "parking_cameras_token_hash_idx" ON "parking_cameras" USING btree ("token_hash");
  CREATE INDEX "parking_cameras_updated_at_idx" ON "parking_cameras" USING btree ("updated_at");
  CREATE INDEX "parking_cameras_created_at_idx" ON "parking_cameras" USING btree ("created_at");
  CREATE INDEX "parking_snapshots_camera_idx" ON "parking_snapshots" USING btree ("camera_id");
  CREATE INDEX "parking_snapshots_lot_idx" ON "parking_snapshots" USING btree ("lot_id");
  CREATE INDEX "parking_snapshots_updated_at_idx" ON "parking_snapshots" USING btree ("updated_at");
  CREATE INDEX "parking_snapshots_created_at_idx" ON "parking_snapshots" USING btree ("created_at");
  CREATE UNIQUE INDEX "parking_snapshots_filename_idx" ON "parking_snapshots" USING btree ("filename");
  CREATE INDEX "parking_snapshots_sizes_web_sizes_web_filename_idx" ON "parking_snapshots" USING btree ("sizes_web_filename");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parking_cameras_fk" FOREIGN KEY ("parking_cameras_id") REFERENCES "public"."parking_cameras"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parking_snapshots_fk" FOREIGN KEY ("parking_snapshots_id") REFERENCES "public"."parking_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_parking_cameras_id_idx" ON "payload_locked_documents_rels" USING btree ("parking_cameras_id");
  CREATE INDEX "payload_locked_documents_rels_parking_snapshots_id_idx" ON "payload_locked_documents_rels" USING btree ("parking_snapshots_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "parking_cameras" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "parking_snapshots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_stats" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "parking_cameras" CASCADE;
  DROP TABLE "parking_snapshots" CASCADE;
  DROP TABLE "payload_jobs_stats" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_parking_cameras_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_parking_snapshots_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sendInvitation', 'purgeMediaEdgeCache');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sendInvitation', 'purgeMediaEdgeCache');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payload_locked_documents_rels_parking_cameras_id_idx";
  DROP INDEX "payload_locked_documents_rels_parking_snapshots_id_idx";
  ALTER TABLE "payload_jobs" DROP COLUMN "meta";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "parking_cameras_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "parking_snapshots_id";
  ALTER TABLE "site_settings" DROP COLUMN "parking_monitor_start";
  ALTER TABLE "site_settings" DROP COLUMN "parking_monitor_end";
  DROP TYPE "public"."enum_parking_cameras_exposure_basis_quality";
  DROP TYPE "public"."enum_parking_snapshots_judge_status";
  DROP TYPE "public"."enum_parking_snapshots_congestion";
  DROP TYPE "public"."enum_parking_snapshots_image_quality";`)
}
