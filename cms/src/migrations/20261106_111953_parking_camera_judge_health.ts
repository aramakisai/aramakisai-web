import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "parking_cameras" ADD COLUMN "judge_health_last_succeeded_at" timestamp(3) with time zone;
  ALTER TABLE "parking_cameras" ADD COLUMN "judge_health_last_failed_at" timestamp(3) with time zone;
  ALTER TABLE "parking_cameras" ADD COLUMN "judge_health_last_error" varchar;
  ALTER TABLE "parking_cameras" ADD COLUMN "judge_health_consecutive_failures" numeric DEFAULT 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "parking_cameras" DROP COLUMN "judge_health_last_succeeded_at";
  ALTER TABLE "parking_cameras" DROP COLUMN "judge_health_last_failed_at";
  ALTER TABLE "parking_cameras" DROP COLUMN "judge_health_last_error";
  ALTER TABLE "parking_cameras" DROP COLUMN "judge_health_consecutive_failures";`)
}
