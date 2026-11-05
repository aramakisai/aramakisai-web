import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "signage_settings" ADD COLUMN "trial_run_start_at" timestamp(3) with time zone;
  ALTER TABLE "signage_settings" ADD COLUMN "trial_run_anchored_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "signage_settings" DROP COLUMN "trial_run_start_at";
  ALTER TABLE "signage_settings" DROP COLUMN "trial_run_anchored_at";`)
}
